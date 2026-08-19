import { t as Schema } from "./lib.js";
import { t as DifyError } from "./types.js";
import { Service } from "@deepseek-ai/cordis";
//#region src/index.ts
/**
* Service Definition for the Dify agent and knowledge-base capability seam
* (`ctx.dify`): the provider registry and provider-selecting execution for
* chat and retrieval. Duplicate ids are rejected. At execution time a
* configured provider must exist and be usable; without one, exactly one usable
* provider is required, so selection never depends on registration order.
*
* This module owns the `ctx.dify` key and nothing else — no HTTP, no tool.
* The provider lives in `@deepseek-ai/dsh-dify/http`, the model-facing tools
* in `@deepseek-ai/dsh-dify/tool`.
*
* @module @deepseek-ai/dsh-dify
*/
/**
* The Dify agent and knowledge-base service. Registered as `ctx.dify`
* (one instance per context).
*
* Selection semantics (resolved at execution time, never order-dependent):
* - A configured id that is registered and `available()` → that provider.
* - A configured id not registered → `DIFY_PROVIDER_CONFIGURED_MISSING`.
* - A configured id registered but unavailable →
*   `DIFY_PROVIDER_CONFIGURED_UNAVAILABLE`.
* - No id configured, exactly one registered usable provider → that provider.
* - No id configured, multiple usable providers → `DIFY_PROVIDER_AMBIGUOUS`.
* - No id configured, no usable provider → `DIFY_PROVIDER_UNAVAILABLE`.
*/
var DifyRuntime = class extends Service {
	/**
	* Provider selection config. The operational env override feeds the SAME
	* field: `$DSH_DIFY_PROVIDER` is equivalent to `provider` and is
	* NOT a hidden priority chain.
	*/
	static Config = Schema.object({ provider: Schema.string() });
	providers = /* @__PURE__ */ new Map();
	providerId;
	constructor(ctx, config = {}) {
		super(ctx, "dify");
		this.providerId = config.provider ?? process.env.DSH_DIFY_PROVIDER;
	}
	/**
	* Register a Dify provider. Throws {@link DifyError}
	* `DIFY_DUPLICATE_PROVIDER` if its id is already registered. Returns a
	* disposer; disposed with the calling fiber.
	* @param provider - the provider; its `id` is the registry key.
	* @returns the disposer that unregisters the provider.
	*/
	registerProvider(provider) {
		if (this.providers.has(provider.id)) throw new DifyError(`a dify provider with id "${provider.id}" is already registered`, "DIFY_DUPLICATE_PROVIDER");
		const store = this.providers;
		const dispose = this.ctx.effect(function* () {
			store.set(provider.id, provider);
			yield () => store.delete(provider.id);
		}, "dify.registerProvider()");
		return () => void dispose();
	}
	/**
	* Send a chat message to a Dify agent through the selected provider.
	* @param request - the chat request.
	* @param signal - optional cancellation signal forwarded to the provider.
	* @returns the agent's answer.
	*/
	async chat(request, signal) {
		return resolveProvider({
			providers: this.providers,
			...this.providerId !== void 0 ? { configuredId: this.providerId } : {}
		}).chat(request, signal);
	}
	/**
	* Retrieve relevant chunks from a Dify knowledge base through the selected
	* provider.
	* @param request - the retrieval request.
	* @param signal - optional cancellation signal forwarded to the provider.
	* @returns the relevant chunks.
	*/
	async retrieve(request, signal) {
		return resolveProvider({
			providers: this.providers,
			...this.providerId !== void 0 ? { configuredId: this.providerId } : {}
		}).retrieve(request, signal);
	}
};
/** Resolve the selected provider or throw the matching {@link DifyError}. */
function resolveProvider(selection) {
	const { configuredId, providers } = selection;
	if (configuredId !== void 0) {
		const provider = providers.get(configuredId);
		if (!provider) throw new DifyError(`configured dify provider "${configuredId}" is not registered`, "DIFY_PROVIDER_CONFIGURED_MISSING");
		if (!provider.available()) throw new DifyError(`configured dify provider "${configuredId}" is registered but unavailable`, "DIFY_PROVIDER_CONFIGURED_UNAVAILABLE");
		return provider;
	}
	const usable = [...providers.values()].filter((provider) => provider.available());
	const [single] = usable;
	if (single === void 0) throw new DifyError("no usable dify provider is registered", "DIFY_PROVIDER_UNAVAILABLE");
	if (usable.length > 1) {
		const ids = usable.map((provider) => provider.id).join(", ");
		throw new DifyError(`multiple usable dify providers are registered (${ids}); configure one explicitly`, "DIFY_PROVIDER_AMBIGUOUS");
	}
	return single;
}
//#endregion
export { DifyError, DifyRuntime, DifyRuntime as default };
