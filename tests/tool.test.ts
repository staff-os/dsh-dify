import { describe, expect, it } from 'vitest'
import {
  formatChatOutput,
  formatRetrieveOutput,
  parseChatArgs,
  parseRetrieveArgs,
  retrieveMetaFromValue,
} from '../src/tool.ts'
import type { DifyChatResult, DifyRetrieveResult } from '../src/types.ts'

const chatResult: DifyChatResult = {
  answer: 'The answer is 42.',
  conversationId: 'conv-1',
  messageId: 'msg-1',
}

const twoChunks: DifyRetrieveResult = {
  chunks: [
    {
      content: 'Plugins export apply(ctx, config).',
      documentName: 'hello-plugin.md',
      score: 0.8123,
    },
    { content: 'Services are injected.', documentId: 'doc-2' },
  ],
}

describe('parseChatArgs', () => {
  it('accepts a real query', () => {
    expect(parseChatArgs({ query: 'how do plugins load?' })).toEqual({ query: 'how do plugins load?' })
  })

  it('rejects a blank query', () => {
    expect(() => parseChatArgs({ query: '   ' })).toThrowError(/non-empty/u)
  })
})

describe('parseRetrieveArgs', () => {
  it('accepts a real query', () => {
    expect(parseRetrieveArgs({ query: 'search me' })).toEqual({ query: 'search me' })
  })

  it('rejects a blank query', () => {
    expect(() => parseRetrieveArgs({ query: '   ' })).toThrowError(/non-empty/u)
  })
})

describe('formatChatOutput', () => {
  it('renders the answer and conversation metadata', () => {
    const text = formatChatOutput(chatResult)
    expect(text).toContain('The answer is 42.')
    expect(text).toContain('conversation: conv-1')
  })

  it('renders the answer alone when no conversation id is present', () => {
    expect(formatChatOutput({ answer: 'hi' })).toBe('hi')
  })
})

describe('formatRetrieveOutput', () => {
  it('numbers chunks, labels them, and shows score when present', () => {
    const text = formatRetrieveOutput(twoChunks)
    expect(text).toContain('### 1. hello-plugin.md — score 0.8123')
    expect(text).toContain('### 2. doc-2')
    expect(text).toContain('Cite the document names above')
  })

  it('renders an empty knowledge base as a usable answer, not a failure', () => {
    const text = formatRetrieveOutput({ chunks: [] })
    expect(text).toContain('No relevant chunks found.')
    expect(text).not.toContain('Cite the document names')
  })
})

describe('retrieveMetaFromValue', () => {
  it('projects chunks into structured JSON', () => {
    const meta = retrieveMetaFromValue(twoChunks)
    expect(meta).toHaveProperty('chunks')
    expect((meta as { chunks: unknown[] }).chunks).toHaveLength(2)
  })
})
