import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  buildChatBody,
  buildRetrieveBody,
  DifyHttpProvider,
  mapDifyChunk,
  mapDifyRetrieveResponse,
} from '../src/provider.ts'
import type { DifyHttpProviderOptions } from '../src/provider.ts'
import { DifyError } from '../src/types.ts'

const baseOptions: DifyHttpProviderOptions = {
  apiKey: 'dify-test-key',
  baseURL: 'https://api.dify.ai/v1',
  user: 'test-user',
  datasetId: 'ds-1',
}

/** A Dify chat success response, as the documented API returns it. */
function chatResponse(): unknown {
  return {
    answer: 'Hello from Dify agent!',
    conversation_id: 'conv-1',
    message_id: 'msg-1',
    task_id: 'task-1',
  }
}

/** A Dify retrieval success response with one chunk. */
function retrieveResponse(): unknown {
  return {
    records: [{
      segment: {
        content: 'Plugins export apply(ctx, config).',
        id: 'seg-1',
        document_name: 'architecture.md',
        document_id: 'doc-1',
        dataset_id: 'ds-1',
        position: 1,
        word_count: 42,
      },
      document: { id: 'doc-1', name: 'architecture.md' },
      score: 0.92,
    }],
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mapDifyChunk', () => {
  it('maps the documented field names', () => {
    const chunk = mapDifyChunk({
      segment: {
        content: 'body',
        id: 'seg-1',
        document_name: 'guide.md',
        document_id: 'doc-1',
        dataset_id: 'ds-1',
      },
      document: { id: 'doc-1', name: 'guide.md' },
      score: 0.85,
    })
    expect(chunk).toEqual({
      content: 'body',
      id: 'seg-1',
      documentName: 'guide.md',
      documentId: 'doc-1',
      datasetId: 'ds-1',
      score: 0.85,
    })
  })

  it('drops a record with no segment', () => {
    expect(mapDifyChunk({ score: 0.5 })).toBeUndefined()
  })

  it('drops a segment with no content', () => {
    expect(mapDifyChunk({ segment: { content: '   ' } })).toBeUndefined()
  })
})

describe('mapDifyRetrieveResponse', () => {
  it('reads records from the response', () => {
    const result = mapDifyRetrieveResponse(retrieveResponse() as never)
    expect(result.chunks).toHaveLength(1)
    expect(result.chunks[0]?.documentName).toBe('architecture.md')
    expect(result.chunks[0]?.score).toBe(0.92)
  })

  it('treats an empty knowledge base as a result, not an error', () => {
    expect(mapDifyRetrieveResponse({ records: [] })).toEqual({ chunks: [] })
  })
})

describe('buildChatBody', () => {
  it('builds a blocking chat request', () => {
    const body = buildChatBody({ query: 'hello' }, baseOptions)
    expect(body).toMatchObject({ query: 'hello', response_mode: 'blocking', user: 'test-user' })
  })

  it('includes conversation_id when provided', () => {
    const body = buildChatBody({ query: 'hello', conversationId: 'conv-1' }, baseOptions)
    expect(body).toMatchObject({ conversation_id: 'conv-1' })
  })

  it('omits conversation_id when not provided', () => {
    const body = buildChatBody({ query: 'hello' }, baseOptions)
    expect(body).not.toHaveProperty('conversation_id')
  })
})

describe('buildRetrieveBody', () => {
  it('uses the configured dataset id', () => {
    const { datasetId, body } = buildRetrieveBody({ query: 'q' }, baseOptions)
    expect(datasetId).toBe('ds-1')
    expect(body).toMatchObject({ query: 'q' })
  })

  it('lets a request dataset id override the configured one', () => {
    const { datasetId } = buildRetrieveBody({ query: 'q', datasetId: 'ds-9' }, baseOptions)
    expect(datasetId).toBe('ds-9')
  })

  it('fails loudly when no dataset id is known', () => {
    expect(() => buildRetrieveBody({ query: 'q' }, { apiKey: 'dify-test-key', baseURL: 'https://api.dify.ai/v1', user: 'test-user' }))
      .toThrowError(expect.objectContaining({ code: 'DIFY_SCOPE_MISSING' }) as Error)
  })
})

describe('DifyHttpProvider', () => {
  it('is unavailable without a key and available with one', () => {
    expect(new DifyHttpProvider(() => ({ ...baseOptions, apiKey: '' })).available()).toBe(false)
    expect(new DifyHttpProvider(() => baseOptions).available()).toBe(true)
  })

  it('is unavailable with an unparseable base URL', () => {
    expect(new DifyHttpProvider(() => ({ ...baseOptions, baseURL: 'not a url' })).available()).toBe(false)
  })

  it('posts to /chat-messages with a bearer key and maps the response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(chatResponse())))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new DifyHttpProvider(() => baseOptions).chat({ query: 'hello' })

    expect(result.answer).toBe('Hello from Dify agent!')
    expect(result.conversationId).toBe('conv-1')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.dify.ai/v1/chat-messages')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer dify-test-key')
    expect(JSON.parse(init.body as string)).toMatchObject({ query: 'hello', response_mode: 'blocking' })
  })

  it('posts to /datasets/{id}/retrieve and maps the response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(retrieveResponse())))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new DifyHttpProvider(() => baseOptions).retrieve({ query: 'how?' })

    expect(result.chunks).toHaveLength(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.dify.ai/v1/datasets/ds-1/retrieve')
  })

  it('surfaces a 401 as unauthorized', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ message: 'bad key' }, 401)))
    await expect(new DifyHttpProvider(() => baseOptions).chat({ query: 'q' }))
      .rejects.toThrowError(expect.objectContaining({ code: 'DIFY_PROVIDER_UNAUTHORIZED' }) as Error)
  })

  it('reports a missing credential before touching the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new DifyHttpProvider(() => ({
      ...baseOptions,
      apiKey: '',
      resolveApiKey: () => Promise.resolve(undefined),
    }))
    await expect(provider.chat({ query: 'q' }))
      .rejects.toThrowError(expect.objectContaining({ code: 'DIFY_PROVIDER_CREDENTIAL_MISSING' }) as Error)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports cancellation as DIFY_ABORTED', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new DOMException('aborted', 'AbortError')))
    const controller = new AbortController()
    controller.abort()
    const error = await new DifyHttpProvider(() => baseOptions)
      .chat({ query: 'q' }, controller.signal)
      .catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(DifyError)
    expect((error as DifyError).code).toBe('DIFY_ABORTED')
  })
})
