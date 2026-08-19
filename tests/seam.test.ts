import { describe, expect, it } from 'vitest'
import { DifyError } from '../src/index.ts'
import type { DifyProvider, DifyChatRequest, DifyChatResult, DifyRetrieveRequest, DifyRetrieveResult } from '../src/types.ts'

/** A test provider that returns canned results. */
function makeProvider(id: string, usable: boolean): DifyProvider {
  return {
    id,
    available: () => usable,
    async chat(request: DifyChatRequest): Promise<DifyChatResult> {
      return { answer: `response from ${id} to: ${request.query}` }
    },
    async retrieve(request: DifyRetrieveRequest): Promise<DifyRetrieveResult> {
      return { chunks: [{ content: `chunk from ${id} for: ${request.query}` }] }
    },
  }
}

describe('DifyError', () => {
  it('carries a machine-routable code', () => {
    const error = new DifyError('test failure', 'TEST_CODE')
    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('test failure')
  })

  it('chains a cause', () => {
    const cause = new Error('root')
    const error = new DifyError('wrapped', 'WRAP', { cause })
    expect(error.cause).toBe(cause)
  })
})

describe('DifyProvider contract', () => {
  it('a usable provider reports available', () => {
    const provider = makeProvider('p1', true)
    expect(provider.available()).toBe(true)
  })

  it('an unusable provider reports unavailable', () => {
    const provider = makeProvider('p2', false)
    expect(provider.available()).toBe(false)
  })

  it('chat returns a canned answer', async () => {
    const provider = makeProvider('p1', true)
    const result = await provider.chat({ query: 'hello' })
    expect(result.answer).toContain('p1')
    expect(result.answer).toContain('hello')
  })

  it('retrieve returns canned chunks', async () => {
    const provider = makeProvider('p1', true)
    const result = await provider.retrieve({ query: 'search' })
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]?.content).toContain('p1')
  })
})
