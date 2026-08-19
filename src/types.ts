/**
 * Vocabulary for the Dify agent and knowledge-base capability seam
 * (`ctx.dify`): the request and result shapes, the provider contract, and
 * the error taxonomy. Providers and consumers depend only on this module, never
 * on each other.
 *
 * Dify's Service API exposes two surfaces this seam models:
 * - **Chat** (`POST /chat-messages`): a conversational agent app with a
 *   `conversation_id`, streaming SSE, and tool/agent events.
 * - **Knowledge retrieval** (`POST /datasets/{id}/retrieve`): a direct
 *   retrieval from a Dify knowledge base (dataset).
 *
 * @module @deepseek-ai/dsh-dify/types
 */

import { HarnessError } from '@deepseek-ai/dsh-llm'

// ── Chat ────────────────────────────────────────────────────────────────────

/**
 * What the model-facing chat tool asks the seam to do. The `query` is the
 * natural-language message; `conversationId` threads a Dify conversation so
 * the agent retains context across calls; `inputs` carries the app's
 * prompt-variable values; `user` is the Dify end-user identifier.
 */
export interface DifyChatRequest {
  /** The natural-language message to send to the Dify agent. */
  readonly query: string
  /** Dify conversation id; omitted starts a new conversation. */
  readonly conversationId?: string
  /** Prompt-variable values for the Dify app. */
  readonly inputs?: readonly Record<string, unknown>[]
  /** Dify end-user identifier (defaults to the configured `user`). */
  readonly user?: string
}

/**
 * One message returned by the Dify chat endpoint. The `answer` is the
 * agent's text; `conversationId` and `messageId` are Dify's identifiers
 * for the conversation and the specific message exchange.
 */
export interface DifyChatResult {
  /** The agent's answer text. */
  readonly answer: string
  /** Dify conversation id; present on the first message of a conversation. */
  readonly conversationId?: string
  /** Dify message id for this exchange. */
  readonly messageId?: string
  /** Dify task id; present when the response is from a blocking call. */
  readonly taskId?: string
}

// ── Knowledge retrieval ──────────────────────────────────────────────────────

/**
 * What the model-facing retrieve tool asks the seam to do. The `query` is the
 * retrieval question; `datasetId` pins the Dify knowledge base; `retrievalModel`
 * carries the Dify retrieval-model configuration (search method, topK, etc.).
 */
export interface DifyRetrieveRequest {
  /** The natural-language query to retrieve relevant knowledge for. */
  readonly query: string
  /** Dify dataset (knowledge base) id; omitted uses the configured default. */
  readonly datasetId?: string
  /** Dify retrieval model configuration. */
  readonly retrievalModel?: DifyRetrievalModel
}

/**
 * Dify's retrieval-model configuration, mirroring the API's
 * `retrieval_model` object. Not every field is required; Dify applies its own
 * defaults when one is absent.
 */
export interface DifyRetrievalModel {
  /** Search method: `semantic_search`, `full_text_search`, or `hybrid_search`. */
  readonly search_method?: 'semantic_search' | 'full_text_search' | 'hybrid_search'
  /** Whether to enable reranking. */
  readonly reranking_enable?: boolean
  /** Reranking model id. */
  readonly reranking_model_id?: string
  /** Reranking mode: `reranking_model` or `weighted_score`. */
  readonly reranking_mode?: string
  /** Top-k for the retrieval. */
  readonly top_k?: number
  /** Score threshold; chunks below it are dropped. */
  readonly score_threshold?: number
  /** Weighted score configuration for hybrid search. */
  readonly weights?: number
}

/**
 * One retrievable knowledge chunk from a Dify dataset.
 */
export interface DifyChunk {
  /** The chunk text content. */
  readonly content: string
  /** Dify's segment id. */
  readonly id?: string
  /** The document name this chunk originates from. */
  readonly documentName?: string
  /** The document id this chunk belongs to. */
  readonly documentId?: string
  /** The dataset (knowledge base) id. */
  readonly datasetId?: string
  /** Provider-reported similarity score. */
  readonly score?: number
  /** The position of the segment in the document. */
  readonly position?: number
  /** Word count of the chunk. */
  readonly wordCount?: number
  /** Highlighted content. */
  readonly highlight?: string
}

/**
 * Normalized retrieval outcome. An empty `chunks[]` is a valid result, not an
 * error: "the knowledge base has nothing relevant" is an answer the model must
 * be able to act on.
 */
export interface DifyRetrieveResult {
  /** Relevant chunks. */
  readonly chunks: readonly DifyChunk[]
}

// ── Provider contract ────────────────────────────────────────────────────────

/**
 * A Dify-capable backend. Registered with
 * `ctx.dify.registerProvider`. `id` is a stable string, unique within the
 * provider registry.
 */
export interface DifyProvider {
  readonly id: string
  /** Cheap local usability check; must not make network calls. */
  available(): boolean
  /** Send a chat message to a Dify agent app. */
  chat(request: DifyChatRequest, signal?: AbortSignal): Promise<DifyChatResult>
  /** Retrieve relevant chunks from a Dify knowledge base. */
  retrieve(request: DifyRetrieveRequest, signal?: AbortSignal): Promise<DifyRetrieveResult>
}

// ── Error taxonomy ────────────────────────────────────────────────────────────

/**
 * Typed Dify error with a machine-routable, open-string `code` and chained
 * `cause`. Shared codes cover unavailable, missing, unusable, ambiguous, or
 * duplicate providers, cancellation, missing credentials, and provider
 * failure. Tool execution exposes the code in structured error metadata.
 */
export class DifyError extends HarnessError {}
