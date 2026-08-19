/**
 * `@deepseek-ai/dsh-dify/tool`: the model-facing `dify_chat` and
 * `dify_retrieve` tools over `ctx.dify`. This module owns the schema, argument
 * validation, prompt guidance, and presentation — never provider selection or
 * network access. Execution goes through the seam.
 *
 * The tools stay registered when no provider is usable: an enabled tool that
 * fails with a structured error at execution time is more debuggable than a
 * tool that silently disappears from the model's list.
 *
 * @module @deepseek-ai/dsh-dify/tool
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, JsonValue } from '@deepseek-ai/dsh-tools'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { DifyChatResult, DifyChunk, DifyRetrieveResult } from './types.ts'
import type {} from './index.ts'
import { DIFY_TOOL_SETTINGS_NAMESPACE } from './settings.ts'

export { DIFY_TOOL_SETTINGS_NAMESPACE } from './settings.ts'

/** Default cooperative tool-call timeout budget (ms). */
export const DEFAULT_DIFY_TOOL_TIMEOUT_MS = 60_000

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-dify'

/** Services required by the Dify tools. */
export const inject = ['tools', 'dify', 'systemPrompt']

/** Plugin config: the per-call timeout budget. */
export interface Config {
  /** Cooperative timeout budget (ms) for one call. Defaults to 60000. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_DIFY_TOOL_TIMEOUT_MS),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

/**
 * Validate value constraints the schema DSL can't express: a non-blank
 * `query`. Throws a plain `Error` otherwise.
 *
 * @param args - the schema-validated `dify_chat` arguments.
 * @returns the accepted arguments, passed through unchanged.
 */
export function parseChatArgs(args: { query: string }): { query: string } {
  if (args.query.trim().length === 0) throw new Error('query must be a non-empty string')
  return { query: args.query }
}

/**
 * Validate value constraints the schema DSL can't express: a non-blank
 * `query`. Throws a plain `Error` otherwise.
 *
 * @param args - the schema-validated `dify_retrieve` arguments.
 * @returns the accepted arguments, passed through unchanged.
 */
export function parseRetrieveArgs(args: { query: string }): { query: string } {
  if (args.query.trim().length === 0) throw new Error('query must be a non-empty string')
  return { query: args.query }
}

/**
 * Format a chat result as one model-facing text block.
 *
 * @param result - the seam's chat outcome.
 * @returns the answer text, with conversation metadata when present.
 */
export function formatChatOutput(result: DifyChatResult): string {
  const parts: string[] = [result.answer]
  if (result.conversationId !== undefined) {
    parts.push(`(conversation: ${result.conversationId})`)
  }
  return parts.join('\n\n')
}

/**
 * Format a retrieval result as one model-facing text block.
 *
 * @param result - the seam's retrieval outcome.
 * @returns the numbered chunks with their source and score metadata (or a
 *   no-results line), and a standing cite-your-sources instruction.
 */
export function formatRetrieveOutput(result: DifyRetrieveResult): string {
  const parts: string[] = []
  if (result.chunks.length > 0) {
    const blocks = result.chunks.map((chunk, index) => {
      const label = chunkLabel(chunk)
      const suffix = chunk.score !== undefined ? ` — score ${chunk.score.toFixed(4)}` : ''
      return `### ${index + 1}. ${label}${suffix}\n\n${chunk.content}`
    })
    parts.push(`Retrieved chunks:\n\n${blocks.join('\n\n---\n\n')}`)
  } else {
    parts.push('No relevant chunks found. The knowledge base has nothing matching this query;'
      + ' answer from other sources or say so, and do not invent a citation.')
  }

  if (result.chunks.length > 0) parts.push('Cite the document names above in your answer.')
  return parts.join('\n\n')
}

/** Display label for a chunk: its document name, else its document id. */
function chunkLabel(chunk: DifyChunk): string {
  if (chunk.documentName !== undefined && chunk.documentName.length > 0) return chunk.documentName
  return chunk.documentId !== undefined && chunk.documentId.length > 0 ? chunk.documentId : 'unknown document'
}

/**
 * Pending-call presentation: a search card titled by the query.
 *
 * @param args - the raw tool arguments; only `query` feeds the view.
 * @returns the generic card view (`kind: 'search'`) shown while the call runs.
 */
export function presentCall(args: { query: string }): GenericCallView {
  return { card: 'generic', title: args.query, kind: 'search', rawInput: args.query }
}

/**
 * Project one seam chunk into a plain object that omits every absent optional
 * field.
 */
function projectChunk(chunk: DifyChunk): {
  content: string
  id?: string
  documentName?: string
  documentId?: string
  datasetId?: string
  score?: number
  position?: number
  wordCount?: number
  highlight?: string
} {
  return {
    content: chunk.content,
    ...chunk.id !== undefined ? { id: chunk.id } : {},
    ...chunk.documentName !== undefined ? { documentName: chunk.documentName } : {},
    ...chunk.documentId !== undefined ? { documentId: chunk.documentId } : {},
    ...chunk.datasetId !== undefined ? { datasetId: chunk.datasetId } : {},
    ...chunk.score !== undefined ? { score: chunk.score } : {},
    ...chunk.position !== undefined ? { position: chunk.position } : {},
    ...chunk.wordCount !== undefined ? { wordCount: chunk.wordCount } : {},
    ...chunk.highlight !== undefined ? { highlight: chunk.highlight } : {},
  }
}

/**
 * Project a validated output value into its replayable presentation meta.
 *
 * @param value - the canonical `dify_retrieve` output value.
 * @returns the structured chunks as opaque JSON.
 */
export function retrieveMetaFromValue(value: DifyRetrieveResult): JsonValue {
  return {
    chunks: value.chunks.map(projectChunk),
  }
}

/**
 * Register the `dify_chat` and `dify_retrieve` tools and their system-prompt
 * guidance. The registrations are effect-scoped, so an HMR reload or an
 * uninstall removes both without manual teardown.
 *
 * `timeoutMs` is read once at registration: a change applies at the next start.
 */
export function apply(ctx: Context, config: Config): void {
  let current = () => config as ResolvedConfig
  installSettingsSection(ctx, DIFY_TOOL_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = () => source() as ResolvedConfig
    },
    onChange: () => {},
  })
  const { timeoutMs } = current()

  ctx.systemPrompt.section({
    name: 'tool:dify_chat',
    order: 110,
    text: 'Use the dify_chat tool to send a message to a Dify agent app and receive its answer.'
      + ' The agent runs on the Dify platform with its own configured tools, knowledge bases,'
      + ' and model — treat the returned answer as authoritative for the Dify app\'s domain.'
      + ' When continuing a conversation, pass the returned conversation_id as conversationId.',
  })

  ctx.systemPrompt.section({
    name: 'tool:dify_retrieve',
    order: 111,
    text: 'Use the dify_retrieve tool to search the connected Dify knowledge bases for relevant'
      + ' document chunks before answering questions about internal, project-specific, or uploaded'
      + ' documents. It returns text chunks with similarity scores and their source document names.'
      + ' Ground the answer in the retrieved chunks and cite the document names; when it returns'
      + ' nothing, say the knowledge base has no relevant content rather than inventing a citation.',
  })

  ctx.tools.register(defineTool({
    name: 'dify_chat',
    description: 'Send a message to a Dify agent app and receive its answer. The agent has its own'
      + ' configured tools, knowledge bases, and model on the Dify platform.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'The natural-language message to send to the Dify agent.',
      },
      conversationId: {
        type: 'string',
        description: 'Dify conversation id to continue a conversation. Omit to start a new one.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          answer: { type: 'string', required: true },
          conversationId: { type: 'string' },
          messageId: { type: 'string' },
          taskId: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatChatOutput(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const { query } = parseChatArgs(args)
      const conversationId = typeof args.conversationId === 'string' && args.conversationId.length > 0
        ? args.conversationId
        : undefined
      const result = await ctx.dify.chat(
        conversationId !== undefined ? { query, conversationId } : { query },
        exec.signal,
      )
      return {
        answer: result.answer,
        ...result.conversationId !== undefined ? { conversationId: result.conversationId } : {},
        ...result.messageId !== undefined ? { messageId: result.messageId } : {},
        ...result.taskId !== undefined ? { taskId: result.taskId } : {},
      }
    },
    presentCall,
    presentResult: (args, result) => {
      if (result.isError) return undefined
      return { card: 'generic', kind: 'search', title: args.query, rawInput: args.query }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'dify_retrieve',
    description: 'Retrieve relevant knowledge chunks from the connected Dify knowledge bases.'
      + ' Returns text chunks from indexed documents with similarity scores and source metadata.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'The natural-language query to retrieve relevant knowledge for.',
      },
      datasetId: {
        type: 'string',
        description: 'Dify dataset (knowledge base) id. Omit to use the configured default.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chunks: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                content: { type: 'string', required: true },
                id: { type: 'string' },
                documentName: { type: 'string' },
                documentId: { type: 'string' },
                datasetId: { type: 'string' },
                score: { type: 'number' },
                position: { type: 'number' },
                wordCount: { type: 'number' },
                highlight: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatRetrieveOutput(value) }],
      presentationMeta: (_args, value) => retrieveMetaFromValue(value),
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const { query } = parseRetrieveArgs(args)
      const datasetId = typeof args.datasetId === 'string' && args.datasetId.length > 0
        ? args.datasetId
        : undefined
      const result = await ctx.dify.retrieve(
        datasetId !== undefined ? { query, datasetId } : { query },
        exec.signal,
      )
      return {
        chunks: result.chunks.map(projectChunk),
      }
    },
    presentCall,
    presentResult: (args, result) => {
      if (result.isError) return undefined
      return { card: 'generic', kind: 'search', title: args.query, rawInput: args.query }
    },
  }))
}
