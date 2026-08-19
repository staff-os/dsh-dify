import { t as Schema } from "./lib.js";
import { t as DifyError } from "./types.js";
import { t as DIFY_HTTP_SETTINGS_NAMESPACE } from "./settings.js";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { installSettingsSection } from "@deepseek-ai/dsh-settings";
//#region src/provider.ts
/** Stable id this provider registers under. */
const DIFY_PROVIDER_ID = "dify-http";
/** Default Dify API endpoint base for cloud. */
const DIFY_DEFAULT_BASE_URL = "https://api.dify.ai/v1";
/** Default Dify end-user identifier. */
const DIFY_DEFAULT_USER = "dsh-user";
/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = "dsh-dify/0.1.0";
/** The chat endpoint appended to the configured base URL. */
const CHAT_PATH = "/chat-messages";
/** The retrieve endpoint template appended to the configured base URL. */
const RETRIEVE_PATH = (datasetId) => `/datasets/${datasetId}/retrieve`;
/** First non-blank string among the candidates, else `undefined`. */
function firstNonBlank(...candidates) {
	for (const candidate of candidates) if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
}
/**
* Map one Dify API record to a normalized chunk, or `undefined` when it
* carries no content.
*
* @param record - one entry of the response's `records[]`.
* @returns the normalized chunk, or `undefined` when it has no content.
*/
function mapDifyChunk(record) {
	const segment = record.segment;
	if (segment === void 0) return void 0;
	const content = firstNonBlank(segment.content)?.trim();
	if (content === void 0) return void 0;
	const id = firstNonBlank(segment.id);
	const documentName = firstNonBlank(segment.document_name, record.document?.name);
	const documentId = firstNonBlank(segment.document_id, record.document?.id);
	const datasetId = firstNonBlank(segment.dataset_id);
	const highlight = firstNonBlank(segment.highlight);
	return {
		content,
		...id !== void 0 ? { id } : {},
		...documentName !== void 0 ? { documentName } : {},
		...documentId !== void 0 ? { documentId } : {},
		...datasetId !== void 0 ? { datasetId } : {},
		...typeof record.score === "number" ? { score: record.score } : {},
		...typeof segment.position === "number" ? { position: segment.position } : {},
		...typeof segment.word_count === "number" ? { wordCount: segment.word_count } : {},
		...highlight !== void 0 ? { highlight } : {}
	};
}
/**
* Map a Dify retrieval response to a normalized retrieval result.
*
* A zero-chunk response is a legitimate outcome, not an error.
*
* @param response - the parsed `POST /datasets/{id}/retrieve` response body.
* @returns the normalized result; content-less entries are dropped.
*/
function mapDifyRetrieveResponse(response) {
	return { chunks: (response.records ?? []).map(mapDifyChunk).filter((chunk) => chunk !== void 0) };
}
/**
* Build the `POST /chat-messages` request body from a seam request and the
* provider's configured defaults.
*
* @param request - the seam-level chat request.
* @param options - the resolved provider options.
* @returns the Dify chat request body.
*/
function buildChatBody(request, options) {
	const user = request.user ?? options.user;
	return {
		query: request.query,
		user,
		response_mode: "blocking",
		...request.inputs !== void 0 && request.inputs.length > 0 ? { inputs: request.inputs[0] } : {},
		...request.conversationId !== void 0 && request.conversationId.length > 0 ? { conversation_id: request.conversationId } : {}
	};
}
/**
* Build the `POST /datasets/{id}/retrieve` request body from a seam request
* and the provider's configured defaults.
*
* @param request - the seam-level retrieval request.
* @param options - the resolved provider options.
* @returns the Dify retrieval request body and resolved dataset id.
* @throws {DifyError} `DIFY_SCOPE_MISSING` when no dataset id is known.
*/
function buildRetrieveBody(request, options) {
	const datasetId = request.datasetId ?? options.datasetId;
	if (datasetId === void 0 || datasetId.length === 0) throw new DifyError("Dify retrieval needs a dataset id; set \"datasetId\" in the provider config or export $DIFY_DATASET_ID", "DIFY_SCOPE_MISSING");
	const body = { query: request.query };
	if (request.retrievalModel !== void 0) body.retrieval_model = retrievalModelToApi(request.retrievalModel);
	return {
		datasetId,
		body
	};
}
/** Convert a seam-level retrieval model to the Dify API's snake_case format. */
function retrievalModelToApi(model) {
	const result = {};
	if (model.search_method !== void 0) result.search_method = model.search_method;
	if (model.reranking_enable !== void 0) result.reranking_enable = model.reranking_enable;
	if (model.reranking_model_id !== void 0) result.reranking_model_id = model.reranking_model_id;
	if (model.reranking_mode !== void 0) result.reranking_mode = model.reranking_mode;
	if (model.top_k !== void 0) result.top_k = model.top_k;
	if (model.score_threshold !== void 0) result.score_threshold = model.score_threshold;
	if (model.weights !== void 0) result.weights = model.weights;
	return result;
}
/** The Dify-HTTP-backed provider; HTTP redirects fail as `DIFY_PROVIDER_ERROR`. */
var DifyHttpProvider = class {
	resolveOptions;
	id = DIFY_PROVIDER_ID;
	constructor(resolveOptions) {
		this.resolveOptions = resolveOptions;
	}
	available() {
		const options = this.resolveOptions();
		return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== void 0) && URL.canParse(options.baseURL);
	}
	async chat(request, signal) {
		const options = this.resolveOptions();
		const body = buildChatBody(request, options);
		const apiKey = await this.resolveApiKey(options, signal);
		throwIfAborted(signal);
		let response;
		try {
			response = await fetch(`${options.baseURL}${CHAT_PATH}`, {
				method: "POST",
				redirect: "error",
				headers: {
					"authorization": `Bearer ${apiKey}`,
					"content-type": "application/json",
					"accept": "application/json",
					"user-agent": USER_AGENT
				},
				body: JSON.stringify(body),
				...signal !== void 0 ? { signal } : {}
			});
		} catch (error) {
			if (isAborted(signal, error)) throw aborted(signal, error);
			throw new DifyError(`Dify chat request failed: ${String(error)}`, "DIFY_PROVIDER_ERROR", { cause: error });
		}
		let parsed;
		try {
			parsed = await response.json();
		} catch (error) {
			if (isAborted(signal, error)) throw aborted(signal, error);
			if (!response.ok) throw new DifyError(`Dify API error (HTTP ${response.status})`, httpErrorCode(response.status), { cause: error });
			throw new DifyError(`Dify returned an unprocessable response body: ${String(error)}`, "DIFY_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			const detail = firstNonBlank(parsed.message);
			throw new DifyError(detail ?? `Dify API error (HTTP ${response.status})`, httpErrorCode(response.status));
		}
		const answer = firstNonBlank(parsed.answer);
		if (answer === void 0) throw new DifyError("Dify returned a chat response with no answer field", "DIFY_PROVIDER_ERROR");
		return {
			answer,
			...firstNonBlank(parsed.conversation_id) !== void 0 ? { conversationId: parsed.conversation_id } : {},
			...firstNonBlank(parsed.message_id) !== void 0 ? { messageId: parsed.message_id } : {},
			...firstNonBlank(parsed.task_id) !== void 0 ? { taskId: parsed.task_id } : {}
		};
	}
	async retrieve(request, signal) {
		const options = this.resolveOptions();
		const { datasetId, body } = buildRetrieveBody(request, options);
		const apiKey = await this.resolveApiKey(options, signal);
		throwIfAborted(signal);
		let response;
		try {
			response = await fetch(`${options.baseURL}${RETRIEVE_PATH(datasetId)}`, {
				method: "POST",
				redirect: "error",
				headers: {
					"authorization": `Bearer ${apiKey}`,
					"content-type": "application/json",
					"accept": "application/json",
					"user-agent": USER_AGENT
				},
				body: JSON.stringify(body),
				...signal !== void 0 ? { signal } : {}
			});
		} catch (error) {
			if (isAborted(signal, error)) throw aborted(signal, error);
			throw new DifyError(`Dify retrieval request failed: ${String(error)}`, "DIFY_PROVIDER_ERROR", { cause: error });
		}
		let parsed;
		try {
			parsed = await response.json();
		} catch (error) {
			if (isAborted(signal, error)) throw aborted(signal, error);
			if (!response.ok) throw new DifyError(`Dify API error (HTTP ${response.status})`, httpErrorCode(response.status), { cause: error });
			throw new DifyError(`Dify returned an unprocessable response body: ${String(error)}`, "DIFY_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			const detail = firstNonBlank(parsed.message);
			throw new DifyError(detail ?? `Dify API error (HTTP ${response.status})`, httpErrorCode(response.status));
		}
		return mapDifyRetrieveResponse(parsed);
	}
	async resolveApiKey(options, signal) {
		throwIfAborted(signal);
		if (options.apiKey !== void 0 && options.apiKey.length > 0) return options.apiKey;
		let resolved;
		try {
			resolved = await options.resolveApiKey?.();
		} catch (error) {
			if (isAborted(signal, error)) throw aborted(signal, error);
			throw new DifyError(`Dify credential resolution failed: ${String(error)}`, "DIFY_PROVIDER_ERROR", { cause: error });
		}
		if (resolved !== void 0 && resolved.length > 0) return resolved;
		const ref = options.apiKeyEnv ?? "DIFY_API_KEY";
		throw new DifyError(`Dify operation has no API key for "${ref}"; store it through the credentials service, export it in the launching environment, or set a literal "apiKey" in the config`, "DIFY_PROVIDER_CREDENTIAL_MISSING");
	}
};
/** An authentication failure is worth its own code; everything else is generic. */
function httpErrorCode(status) {
	return status === 401 || status === 403 ? "DIFY_PROVIDER_UNAUTHORIZED" : "DIFY_PROVIDER_ERROR";
}
function throwIfAborted(signal) {
	if (signal?.aborted === true) throw aborted(signal);
}
function isAborted(signal, error) {
	return signal?.aborted === true || error instanceof DOMException && error.name === "AbortError";
}
function aborted(signal, fallback) {
	return new DifyError("Dify operation aborted", "DIFY_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
//#endregion
//#region src/http.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "dify-http";
/** The Dify seam this provider registers into. */
const inject = ["dify"];
/** Credential reference resolved when no literal `apiKey` is configured. */
const DEFAULT_API_KEY_ENV = "DIFY_API_KEY";
/** Launch-environment variable naming the endpoint base. */
const BASE_URL_ENV = "DIFY_BASE_URL";
/** Launch-environment variable naming the default dataset. */
const DATASET_ID_ENV = "DIFY_DATASET_ID";
/** Launch-environment variable naming the Dify end-user. */
const USER_ENV = "DIFY_USER";
const Config = Schema.object({
	apiKey: Schema.string().role("secret"),
	apiKeyEnv: Schema.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: Schema.string(),
	user: Schema.string(),
	datasetId: Schema.string()
});
/**
* Resolve provider options from config and the launch environment. Called per
* operation so a credential or environment change takes effect without a
* reload; the provider snapshots it once per operation.
*
* @param ctx - the plugin context (owns the credentials seam and launch env).
* @param config - the schema-validated plugin config.
* @returns the fully resolved provider options.
*/
function resolveProviderOptions(ctx, config) {
	const env = launchEnvironmentOf(ctx);
	const apiKeyEnv = credentialRef(config.apiKeyEnv ?? "DIFY_API_KEY");
	const datasetId = config.datasetId !== void 0 && config.datasetId.length > 0 ? config.datasetId : env.get(DATASET_ID_ENV)?.value;
	const user = config.user !== void 0 && config.user.length > 0 ? config.user : env.get("DIFY_USER")?.value ?? "dsh-user";
	return {
		...config.apiKey !== void 0 && config.apiKey.length > 0 ? { apiKey: config.apiKey } : {},
		resolveApiKey: async () => {
			const credentials = ctx.get("credentials");
			if (credentials !== void 0) return (await credentials.resolve(apiKeyEnv))?.value;
			const ambient = env.get(apiKeyEnv);
			return ambient !== void 0 && ambient.value.length > 0 ? ambient.value : void 0;
		},
		apiKeyEnv,
		baseURL: config.baseURL ?? env.get("DIFY_BASE_URL")?.value ?? "https://api.dify.ai/v1",
		user,
		...datasetId !== void 0 && datasetId.length > 0 ? { datasetId } : {}
	};
}
/**
* Register the Dify HTTP provider with `ctx.dify`. The registration is an
* effect owned by this plugin's fiber, so an HMR reload or an uninstall
* unregisters it without manual teardown.
*
* The authoritative config is a thunk, not the entry object: while a settings
* provider is mounted, `installSettingsSection` points it at the resolved
* `dify-http` section, so a value saved in the configuration page reaches the
* NEXT operation without a reload. Options are resolved per operation already,
* so nothing here needs to react to a change.
*/
function apply(ctx, config) {
	let current = () => config;
	installSettingsSection(ctx, DIFY_HTTP_SETTINGS_NAMESPACE, Config, config, {
		setSource: (source) => {
			current = source;
		},
		onChange: () => {}
	});
	ctx.dify.registerProvider(new DifyHttpProvider(() => resolveProviderOptions(ctx, current())));
}
//#endregion
export { mapDifyRetrieveResponse as _, USER_ENV as a, name as c, DIFY_DEFAULT_USER as d, DIFY_PROVIDER_ID as f, mapDifyChunk as g, buildRetrieveBody as h, DEFAULT_API_KEY_ENV as i, resolveProviderOptions as l, buildChatBody as m, Config as n, apply as o, DifyHttpProvider as p, DATASET_ID_ENV as r, inject as s, BASE_URL_ENV as t, DIFY_DEFAULT_BASE_URL as u };
