import { t as Schema } from "./lib.js";
import { n as DIFY_TOOL_SETTINGS_NAMESPACE } from "./settings.js";
import { installSettingsSection } from "@deepseek-ai/dsh-settings";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/tool.ts
/** Default cooperative tool-call timeout budget (ms). */
const DEFAULT_DIFY_TOOL_TIMEOUT_MS = 6e4;
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-dify";
/** Services required by the Dify tools. */
const inject = [
	"tools",
	"dify",
	"systemPrompt"
];
const Config = Schema.object({ timeoutMs: Schema.number().step(1).min(1).default(DEFAULT_DIFY_TOOL_TIMEOUT_MS) });
/**
* Validate value constraints the schema DSL can't express: a non-blank
* `query`. Throws a plain `Error` otherwise.
*
* @param args - the schema-validated `dify_chat` arguments.
* @returns the accepted arguments, passed through unchanged.
*/
function parseChatArgs(args) {
	if (args.query.trim().length === 0) throw new Error("query must be a non-empty string");
	return { query: args.query };
}
/**
* Validate value constraints the schema DSL can't express: a non-blank
* `query`. Throws a plain `Error` otherwise.
*
* @param args - the schema-validated `dify_retrieve` arguments.
* @returns the accepted arguments, passed through unchanged.
*/
function parseRetrieveArgs(args) {
	if (args.query.trim().length === 0) throw new Error("query must be a non-empty string");
	return { query: args.query };
}
/**
* Format a chat result as one model-facing text block.
*
* @param result - the seam's chat outcome.
* @returns the answer text, with conversation metadata when present.
*/
function formatChatOutput(result) {
	const parts = [result.answer];
	if (result.conversationId !== void 0) parts.push(`(conversation: ${result.conversationId})`);
	return parts.join("\n\n");
}
/**
* Format a retrieval result as one model-facing text block.
*
* @param result - the seam's retrieval outcome.
* @returns the numbered chunks with their source and score metadata (or a
*   no-results line), and a standing cite-your-sources instruction.
*/
function formatRetrieveOutput(result) {
	const parts = [];
	if (result.chunks.length > 0) {
		const blocks = result.chunks.map((chunk, index) => {
			const label = chunkLabel(chunk);
			const suffix = chunk.score !== void 0 ? ` — score ${chunk.score.toFixed(4)}` : "";
			return `### ${index + 1}. ${label}${suffix}\n\n${chunk.content}`;
		});
		parts.push(`Retrieved chunks:\n\n${blocks.join("\n\n---\n\n")}`);
	} else parts.push("No relevant chunks found. The knowledge base has nothing matching this query; answer from other sources or say so, and do not invent a citation.");
	if (result.chunks.length > 0) parts.push("Cite the document names above in your answer.");
	return parts.join("\n\n");
}
/** Display label for a chunk: its document name, else its document id. */
function chunkLabel(chunk) {
	if (chunk.documentName !== void 0 && chunk.documentName.length > 0) return chunk.documentName;
	return chunk.documentId !== void 0 && chunk.documentId.length > 0 ? chunk.documentId : "unknown document";
}
/**
* Pending-call presentation: a search card titled by the query.
*
* @param args - the raw tool arguments; only `query` feeds the view.
* @returns the generic card view (`kind: 'search'`) shown while the call runs.
*/
function presentCall(args) {
	return {
		card: "generic",
		title: args.query,
		kind: "search",
		rawInput: args.query
	};
}
/**
* Project one seam chunk into a plain object that omits every absent optional
* field.
*/
function projectChunk(chunk) {
	return {
		content: chunk.content,
		...chunk.id !== void 0 ? { id: chunk.id } : {},
		...chunk.documentName !== void 0 ? { documentName: chunk.documentName } : {},
		...chunk.documentId !== void 0 ? { documentId: chunk.documentId } : {},
		...chunk.datasetId !== void 0 ? { datasetId: chunk.datasetId } : {},
		...chunk.score !== void 0 ? { score: chunk.score } : {},
		...chunk.position !== void 0 ? { position: chunk.position } : {},
		...chunk.wordCount !== void 0 ? { wordCount: chunk.wordCount } : {},
		...chunk.highlight !== void 0 ? { highlight: chunk.highlight } : {}
	};
}
/**
* Project a validated output value into its replayable presentation meta.
*
* @param value - the canonical `dify_retrieve` output value.
* @returns the structured chunks as opaque JSON.
*/
function retrieveMetaFromValue(value) {
	return { chunks: value.chunks.map(projectChunk) };
}
/**
* Register the `dify_chat` and `dify_retrieve` tools and their system-prompt
* guidance. The registrations are effect-scoped, so an HMR reload or an
* uninstall removes both without manual teardown.
*
* `timeoutMs` is read once at registration: a change applies at the next start.
*/
function apply(ctx, config) {
	let current = () => config;
	installSettingsSection(ctx, DIFY_TOOL_SETTINGS_NAMESPACE, Config, config, {
		setSource: (source) => {
			current = () => source();
		},
		onChange: () => {}
	});
	const { timeoutMs } = current();
	ctx.systemPrompt.section({
		name: "tool:dify_chat",
		order: 110,
		text: "Use the dify_chat tool to send a message to a Dify agent app and receive its answer. The agent runs on the Dify platform with its own configured tools, knowledge bases, and model — treat the returned answer as authoritative for the Dify app's domain. When continuing a conversation, pass the returned conversation_id as conversationId."
	});
	ctx.systemPrompt.section({
		name: "tool:dify_retrieve",
		order: 111,
		text: "Use the dify_retrieve tool to search the connected Dify knowledge bases for relevant document chunks before answering questions about internal, project-specific, or uploaded documents. It returns text chunks with similarity scores and their source document names. Ground the answer in the retrieved chunks and cite the document names; when it returns nothing, say the knowledge base has no relevant content rather than inventing a citation."
	});
	ctx.tools.register(defineTool({
		name: "dify_chat",
		description: "Send a message to a Dify agent app and receive its answer. The agent has its own configured tools, knowledge bases, and model on the Dify platform.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "The natural-language message to send to the Dify agent."
			},
			conversationId: {
				type: "string",
				description: "Dify conversation id to continue a conversation. Omit to start a new one."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					answer: {
						type: "string",
						required: true
					},
					conversationId: { type: "string" },
					messageId: { type: "string" },
					taskId: { type: "string" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: formatChatOutput(value)
			}]
		},
		timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const { query } = parseChatArgs(args);
			const conversationId = typeof args.conversationId === "string" && args.conversationId.length > 0 ? args.conversationId : void 0;
			const result = await ctx.dify.chat(conversationId !== void 0 ? {
				query,
				conversationId
			} : { query }, exec.signal);
			return {
				answer: result.answer,
				...result.conversationId !== void 0 ? { conversationId: result.conversationId } : {},
				...result.messageId !== void 0 ? { messageId: result.messageId } : {},
				...result.taskId !== void 0 ? { taskId: result.taskId } : {}
			};
		},
		presentCall,
		presentResult: (args, result) => {
			if (result.isError) return void 0;
			return {
				card: "generic",
				kind: "search",
				title: args.query,
				rawInput: args.query
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "dify_retrieve",
		description: "Retrieve relevant knowledge chunks from the connected Dify knowledge bases. Returns text chunks from indexed documents with similarity scores and source metadata.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "The natural-language query to retrieve relevant knowledge for."
			},
			datasetId: {
				type: "string",
				description: "Dify dataset (knowledge base) id. Omit to use the configured default."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { chunks: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							content: {
								type: "string",
								required: true
							},
							id: { type: "string" },
							documentName: { type: "string" },
							documentId: { type: "string" },
							datasetId: { type: "string" },
							score: { type: "number" },
							position: { type: "number" },
							wordCount: { type: "number" },
							highlight: { type: "string" }
						}
					}
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: formatRetrieveOutput(value)
			}],
			presentationMeta: (_args, value) => retrieveMetaFromValue(value)
		},
		timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const { query } = parseRetrieveArgs(args);
			const datasetId = typeof args.datasetId === "string" && args.datasetId.length > 0 ? args.datasetId : void 0;
			return { chunks: (await ctx.dify.retrieve(datasetId !== void 0 ? {
				query,
				datasetId
			} : { query }, exec.signal)).chunks.map(projectChunk) };
		},
		presentCall,
		presentResult: (args, result) => {
			if (result.isError) return void 0;
			return {
				card: "generic",
				kind: "search",
				title: args.query,
				rawInput: args.query
			};
		}
	}));
}
//#endregion
export { Config, DEFAULT_DIFY_TOOL_TIMEOUT_MS, DIFY_TOOL_SETTINGS_NAMESPACE, apply, formatChatOutput, formatRetrieveOutput, inject, name, parseChatArgs, parseRetrieveArgs, presentCall, retrieveMetaFromValue };
