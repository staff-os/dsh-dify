/**
 * `DifyHttpProvider`: a {@link DifyProvider} backed by the Dify Service API.
 *
 * Two Dify contract details this module owns:
 * - Dify's Service API base is `https://api.dify.ai/v1` for cloud, or
 *   `http://<host>/v1` for self-hosted. All endpoints are appended to this base.
 * - Dify authenticates with `Authorization: Bearer {api_key}`, where the key
 *   is per-app (each Dify app has its own API key).
 *
 * The chat endpoint (`POST /chat-messages`) supports both blocking and
 * streaming modes. This provider uses blocking mode (`response_mode: blocking`)
 * because the DSH tool framework awaits a complete result. The response is a
 * JSON object with `answer`, `conversation_id`, and `message_id`.
 *
 * The retrieval endpoint (`POST /datasets/{id}/retrieve`) returns relevant
 * chunks from a Dify knowledge base. The response is a JSON object with a
 * `records` array of chunk objects.
 *
 * @module @deepseek-ai/dsh-dify/provider
 */

import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { DifyError } from './types.ts'
import type {
  DifyChatRequest,
  DifyChatResult,
  DifyChunk,
  DifyProvider,
  DifyRetrieveRequest,
  DifyRetrieveResult,
  DifyRetrievalModel,
} from './types.ts'

/** Stable id this provider registers under. */
export const DIFY_PROVIDER_ID = 'dify-http'

/** Default Dify API endpoint base for cloud. */
export const DIFY_DEFAULT_BASE_URL = 'https://api.dify.ai/v1'

/** Default Dify end-user identifier. */
export const DIFY_DEFAULT_USER = 'dsh-user'

/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = 'dsh-dify/0.1.0'

/** The chat endpoint appended to the configured base URL. */
const CHAT_PATH = '/chat-messages'

/** The retrieve endpoint template appended to the configured base URL. */
const RETRIEVE_PATH = (datasetId: string) => `/datasets/${datasetId}/retrieve`

/** Resolved provider options (the plugin's `apply` supplies every default). */
export interface DifyHttpProviderOptions {
  /** Literal Dify API key; when present it wins over {@link resolveApiKey}. */
  apiKey?: string
  /** Resolve the current Dify API key for one operation. */
  resolveApiKey?: () => Promise<string | undefined>
  /** Credential reference named by missing-credential diagnostics. */
  apiKeyEnv?: CredentialRef
  /** Endpoint base; `/chat-messages` and `/datasets/...` are appended. */
  baseURL: string
  /** Dify end-user identifier. */
  user: string
  /** Dataset id searched when a request carries none of its own. */
  datasetId?: string
}

// ── Chat response shapes ────────────────────────────────────────────────────

/** Dify chat response body (blocking mode). */
export interface DifyApiChatResponse {
  answer?: string
  conversation_id?: string
  message_id?: string
  task_id?: string
}

// ── Retrieval response shapes ────────────────────────────────────────────────

/** One chunk item inside a Dify retrieval response. */
export interface DifyApiChunk {
  content?: string
  id?: string
  document_name?: string
  document_id?: string
  dataset_id?: string
  score?: number
  position?: number
  word_count?: number
  highlight?: string
}

/** Dify retrieval response body. */
export interface DifyApiRetrieveResponse {
  records?: DifyApiRecord[] | null
}

/** One record inside a Dify retrieval response. */
export interface DifyApiRecord {
  segment?: DifyApiChunk
  document?: { id?: string, name?: string }
  score?: number
}

/** First non-blank string among the candidates, else `undefined`. */
function firstNonBlank(...candidates: (string | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate
  }
  return undefined
}

/**
 * Map one Dify API record to a normalized chunk, or `undefined` when it
 * carries no content.
 *
 * @param record - one entry of the response's `records[]`.
 * @returns the normalized chunk, or `undefined` when it has no content.
 */
export function mapDifyChunk(record: DifyApiRecord): DifyChunk | undefined {
  const segment = record.segment
  if (segment === undefined) return undefined
  const content = firstNonBlank(segment.content)?.trim()
  if (content === undefined) return undefined
  const id = firstNonBlank(segment.id)
  const documentName = firstNonBlank(segment.document_name, record.document?.name)
  const documentId = firstNonBlank(segment.document_id, record.document?.id)
  const datasetId = firstNonBlank(segment.dataset_id)
  const highlight = firstNonBlank(segment.highlight)
  return {
    content,
    ...id !== undefined ? { id } : {},
    ...documentName !== undefined ? { documentName } : {},
    ...documentId !== undefined ? { documentId } : {},
    ...datasetId !== undefined ? { datasetId } : {},
    ...typeof record.score === 'number' ? { score: record.score } : {},
    ...typeof segment.position === 'number' ? { position: segment.position } : {},
    ...typeof segment.word_count === 'number' ? { wordCount: segment.word_count } : {},
    ...highlight !== undefined ? { highlight } : {},
  }
}

/**
 * Map a Dify retrieval response to a normalized retrieval result.
 *
 * A zero-chunk response is a legitimate outcome, not an error.
 *
 * @param response - the parsed `POST /datasets/{id}/retrieve` response body.
 * @returns the normalized result; content-less entries are dropped.
 */
export function mapDifyRetrieveResponse(response: DifyApiRetrieveResponse): DifyRetrieveResult {
  const records = response.records ?? []
  const chunks = records
    .map(mapDifyChunk)
    .filter((chunk): chunk is DifyChunk => chunk !== undefined)
  return { chunks }
}

/**
 * Build the `POST /chat-messages` request body from a seam request and the
 * provider's configured defaults.
 *
 * @param request - the seam-level chat request.
 * @param options - the resolved provider options.
 * @returns the Dify chat request body.
 */
export function buildChatBody(
  request: DifyChatRequest,
  options: DifyHttpProviderOptions,
): Record<string, unknown> {
  const user = request.user ?? options.user
  return {
    query: request.query,
    user,
    response_mode: 'blocking',
    ...request.inputs !== undefined && request.inputs.length > 0 ? { inputs: request.inputs[0] } : {},
    ...request.conversationId !== undefined && request.conversationId.length > 0
      ? { conversation_id: request.conversationId }
      : {},
  }
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
export function buildRetrieveBody(
  request: DifyRetrieveRequest,
  options: DifyHttpProviderOptions,
): { datasetId: string, body: Record<string, unknown> } {
  const datasetId = request.datasetId ?? options.datasetId
  if (datasetId === undefined || datasetId.length === 0) {
    throw new DifyError(
      'Dify retrieval needs a dataset id; set "datasetId" in the provider config'
      + ' or export $DIFY_DATASET_ID',
      'DIFY_SCOPE_MISSING',
    )
  }
  const body: Record<string, unknown> = { query: request.query }
  if (request.retrievalModel !== undefined) {
    body.retrieval_model = retrievalModelToApi(request.retrievalModel)
  }
  return { datasetId, body }
}

/** Convert a seam-level retrieval model to the Dify API's snake_case format. */
function retrievalModelToApi(model: DifyRetrievalModel): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (model.search_method !== undefined) result.search_method = model.search_method
  if (model.reranking_enable !== undefined) result.reranking_enable = model.reranking_enable
  if (model.reranking_model_id !== undefined) result.reranking_model_id = model.reranking_model_id
  if (model.reranking_mode !== undefined) result.reranking_mode = model.reranking_mode
  if (model.top_k !== undefined) result.top_k = model.top_k
  if (model.score_threshold !== undefined) result.score_threshold = model.score_threshold
  if (model.weights !== undefined) result.weights = model.weights
  return result
}

/** The Dify-HTTP-backed provider; HTTP redirects fail as `DIFY_PROVIDER_ERROR`. */
export class DifyHttpProvider implements DifyProvider {
  readonly id = DIFY_PROVIDER_ID

  constructor(private readonly resolveOptions: () => DifyHttpProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== undefined)
      && URL.canParse(options.baseURL)
  }

  async chat(request: DifyChatRequest, signal?: AbortSignal): Promise<DifyChatResult> {
    const options = this.resolveOptions()
    const body = buildChatBody(request, options)
    const apiKey = await this.resolveApiKey(options, signal)
    throwIfAborted(signal)

    let response: Response
    try {
      response = await fetch(`${options.baseURL}${CHAT_PATH}`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify(body),
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAborted(signal, error)) throw aborted(signal, error)
      throw new DifyError(`Dify chat request failed: ${String(error)}`, 'DIFY_PROVIDER_ERROR', { cause: error })
    }

    let parsed: DifyApiChatResponse
    try {
      parsed = await response.json() as DifyApiChatResponse
    } catch (error: unknown) {
      if (isAborted(signal, error)) throw aborted(signal, error)
      if (!response.ok) {
        throw new DifyError(`Dify API error (HTTP ${response.status})`, httpErrorCode(response.status), { cause: error })
      }
      throw new DifyError(`Dify returned an unprocessable response body: ${String(error)}`, 'DIFY_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const detail = firstNonBlank((parsed as unknown as { message?: string }).message)
      throw new DifyError(detail ?? `Dify API error (HTTP ${response.status})`, httpErrorCode(response.status))
    }

    const answer = firstNonBlank(parsed.answer)
    if (answer === undefined) {
      throw new DifyError('Dify returned a chat response with no answer field', 'DIFY_PROVIDER_ERROR')
    }

    return {
      answer,
      ...firstNonBlank(parsed.conversation_id) !== undefined ? { conversationId: parsed.conversation_id } : {},
      ...firstNonBlank(parsed.message_id) !== undefined ? { messageId: parsed.message_id } : {},
      ...firstNonBlank(parsed.task_id) !== undefined ? { taskId: parsed.task_id } : {},
    }
  }

  async retrieve(request: DifyRetrieveRequest, signal?: AbortSignal): Promise<DifyRetrieveResult> {
    const options = this.resolveOptions()
    const { datasetId, body } = buildRetrieveBody(request, options)
    const apiKey = await this.resolveApiKey(options, signal)
    throwIfAborted(signal)

    let response: Response
    try {
      response = await fetch(`${options.baseURL}${RETRIEVE_PATH(datasetId)}`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify(body),
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAborted(signal, error)) throw aborted(signal, error)
      throw new DifyError(`Dify retrieval request failed: ${String(error)}`, 'DIFY_PROVIDER_ERROR', { cause: error })
    }

    let parsed: DifyApiRetrieveResponse
    try {
      parsed = await response.json() as DifyApiRetrieveResponse
    } catch (error: unknown) {
      if (isAborted(signal, error)) throw aborted(signal, error)
      if (!response.ok) {
        throw new DifyError(`Dify API error (HTTP ${response.status})`, httpErrorCode(response.status), { cause: error })
      }
      throw new DifyError(`Dify returned an unprocessable response body: ${String(error)}`, 'DIFY_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const detail = firstNonBlank((parsed as unknown as { message?: string }).message)
      throw new DifyError(detail ?? `Dify API error (HTTP ${response.status})`, httpErrorCode(response.status))
    }

    return mapDifyRetrieveResponse(parsed)
  }

  private async resolveApiKey(options: DifyHttpProviderOptions, signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal)
    if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey
    let resolved: string | undefined
    try {
      resolved = await options.resolveApiKey?.()
    } catch (error: unknown) {
      if (isAborted(signal, error)) throw aborted(signal, error)
      throw new DifyError(
        `Dify credential resolution failed: ${String(error)}`,
        'DIFY_PROVIDER_ERROR',
        { cause: error },
      )
    }
    if (resolved !== undefined && resolved.length > 0) return resolved
    const ref = options.apiKeyEnv ?? 'DIFY_API_KEY'
    throw new DifyError(
      `Dify operation has no API key for "${ref}"; store it through the credentials service`
      + ', export it in the launching environment, or set a literal "apiKey" in the config',
      'DIFY_PROVIDER_CREDENTIAL_MISSING',
    )
  }
}

/** An authentication failure is worth its own code; everything else is generic. */
function httpErrorCode(status: number): string {
  return status === 401 || status === 403 ? 'DIFY_PROVIDER_UNAUTHORIZED' : 'DIFY_PROVIDER_ERROR'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw aborted(signal)
}

function isAborted(signal: AbortSignal | undefined, error: unknown): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
}

function aborted(signal?: AbortSignal, fallback?: unknown): DifyError {
  return new DifyError('Dify operation aborted', 'DIFY_ABORTED', {
    cause: signal?.aborted === true ? signal.reason : fallback,
  })
}
