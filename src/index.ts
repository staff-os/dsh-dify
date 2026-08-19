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

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  DifyProvider,
  DifyChatRequest,
  DifyChatResult,
  DifyRetrieveRequest,
  DifyRetrieveResult,
} from './types.ts'
import { DifyError } from './types.ts'

export { DifyError } from './types.ts'
export type {
  DifyChunk,
  DifyChatRequest,
  DifyChatResult,
  DifyProvider,
  DifyRetrieveRequest,
  DifyRetrieveResult,
  DifyRetrievalModel,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    dify: DifyRuntime
  }
}

/** Selection inputs for execution-time provider resolution. */
interface Selection<P> {
  /** The configured provider id for this capability, if any. */
  readonly configuredId?: string
  /** Providers registered for this capability kind. */
  readonly providers: ReadonlyMap<string, P>
}

/**
 * Config for the Dify seam. `provider` pins which provider wins; it
 * is optional (a single registered usable provider auto-selects). Operational
 * overrides such as environment variables must feed this same field rather than
 * introduce a hidden priority chain.
 */
export interface DifyRuntimeConfig {
  /** Explicit Dify provider id. Omitted = auto-select when exactly one usable. */
  readonly provider?: string
}

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
export class DifyRuntime extends Service {
  /**
   * Provider selection config. The operational env override feeds the SAME
   * field: `$DSH_DIFY_PROVIDER` is equivalent to `provider` and is
   * NOT a hidden priority chain.
   */
  static Config: z<DifyRuntimeConfig> = z.object({
    provider: z.string(),
  })

  private providers = new Map<string, DifyProvider>()
  private readonly providerId: string | undefined

  constructor(ctx: Context, config: DifyRuntimeConfig = {}) {
    super(ctx, 'dify')
    this.providerId = config.provider ?? process.env.DSH_DIFY_PROVIDER
  }

  /**
   * Register a Dify provider. Throws {@link DifyError}
   * `DIFY_DUPLICATE_PROVIDER` if its id is already registered. Returns a
   * disposer; disposed with the calling fiber.
   * @param provider - the provider; its `id` is the registry key.
   * @returns the disposer that unregisters the provider.
   */
  registerProvider(provider: DifyProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new DifyError(`a dify provider with id "${provider.id}" is already registered`, 'DIFY_DUPLICATE_PROVIDER')
    }
    const store = this.providers
    const dispose = this.ctx.effect(function* () {
      store.set(provider.id, provider)
      yield () => store.delete(provider.id)
    }, 'dify.registerProvider()')
    return () => void dispose()
  }

  /**
   * Send a chat message to a Dify agent through the selected provider.
   * @param request - the chat request.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the agent's answer.
   */
  async chat(request: DifyChatRequest, signal?: AbortSignal): Promise<DifyChatResult> {
    const provider = resolveProvider({
      providers: this.providers,
      ...this.providerId !== undefined ? { configuredId: this.providerId } : {},
    })
    return provider.chat(request, signal)
  }

  /**
   * Retrieve relevant chunks from a Dify knowledge base through the selected
   * provider.
   * @param request - the retrieval request.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the relevant chunks.
   */
  async retrieve(request: DifyRetrieveRequest, signal?: AbortSignal): Promise<DifyRetrieveResult> {
    const provider = resolveProvider({
      providers: this.providers,
      ...this.providerId !== undefined ? { configuredId: this.providerId } : {},
    })
    return provider.retrieve(request, signal)
  }
}

interface ResolvableProvider {
  readonly id: string
  available(): boolean
}

/** Resolve the selected provider or throw the matching {@link DifyError}. */
function resolveProvider<P extends ResolvableProvider>(selection: Selection<P>): P {
  const { configuredId, providers } = selection
  if (configuredId !== undefined) {
    const provider = providers.get(configuredId)
    if (!provider) {
      throw new DifyError(`configured dify provider "${configuredId}" is not registered`, 'DIFY_PROVIDER_CONFIGURED_MISSING')
    }
    if (!provider.available()) {
      throw new DifyError(`configured dify provider "${configuredId}" is registered but unavailable`, 'DIFY_PROVIDER_CONFIGURED_UNAVAILABLE')
    }
    return provider
  }
  const usable = [...providers.values()].filter(provider => provider.available())
  const [single] = usable
  if (single === undefined) {
    throw new DifyError('no usable dify provider is registered', 'DIFY_PROVIDER_UNAVAILABLE')
  }
  if (usable.length > 1) {
    const ids = usable.map(provider => provider.id).join(', ')
    throw new DifyError(`multiple usable dify providers are registered (${ids}); configure one explicitly`, 'DIFY_PROVIDER_AMBIGUOUS')
  }
  return single
}

export default DifyRuntime
