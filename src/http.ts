/**
 * `@deepseek-ai/dsh-dify/http`: registers a Dify-HTTP-backed
 * {@link DifyHttpProvider} with `ctx.dify`. A function/namespace plugin (NOT a
 * default-export service): a Dify provider does not own the `ctx.dify` key —
 * it registers INTO the seam's provider registry. The key is owned by
 * `@deepseek-ai/dsh-dify`.
 *
 * Every option this plugin resolves — endpoint, scope, credential reference —
 * may also come from the launch environment, so a deployment can be configured
 * without editing any YAML.
 *
 * @module @deepseek-ai/dsh-dify/http
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import type {} from './index.ts'
import { DIFY_HTTP_SETTINGS_NAMESPACE } from './settings.ts'
import {
  DIFY_DEFAULT_BASE_URL,
  DIFY_DEFAULT_USER,
  DifyHttpProvider,
} from './provider.ts'
import type { DifyHttpProviderOptions } from './provider.ts'

export { DIFY_HTTP_SETTINGS_NAMESPACE } from './settings.ts'
export {
  buildChatBody,
  buildRetrieveBody,
  DIFY_DEFAULT_BASE_URL,
  DIFY_DEFAULT_USER,
  DIFY_PROVIDER_ID,
  DifyHttpProvider,
  mapDifyChunk,
  mapDifyRetrieveResponse,
} from './provider.ts'
export type {
  DifyApiChatResponse,
  DifyApiChunk,
  DifyApiRetrieveResponse,
  DifyApiRecord,
  DifyHttpProviderOptions,
} from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dify-http'

/** The Dify seam this provider registers into. */
export const inject = ['dify']

/** Credential reference resolved when no literal `apiKey` is configured. */
export const DEFAULT_API_KEY_ENV = 'DIFY_API_KEY'

/** Launch-environment variable naming the endpoint base. */
export const BASE_URL_ENV = 'DIFY_BASE_URL'

/** Launch-environment variable naming the default dataset. */
export const DATASET_ID_ENV = 'DIFY_DATASET_ID'

/** Launch-environment variable naming the Dify end-user. */
export const USER_ENV = 'DIFY_USER'

/** Plugin config. Every field is optional — `apply` fills env-var and constant defaults. */
export interface Config {
  /** Literal Dify API key; prefer {@link apiKeyEnv} so no secret enters a config file. */
  apiKey?: string
  /** Credential reference resolved per operation. Defaults to `DIFY_API_KEY`. */
  apiKeyEnv?: string
  /** Endpoint base; `/chat-messages` and `/datasets/...` are appended. Falls back to `$DIFY_BASE_URL`. */
  baseURL?: string
  /** Dify end-user identifier. Falls back to `$DIFY_USER`. */
  user?: string
  /** Dataset id searched when a request carries none of its own. Falls back to `$DIFY_DATASET_ID`. */
  datasetId?: string
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
  user: z.string(),
  datasetId: z.string(),
})

/**
 * Resolve provider options from config and the launch environment. Called per
 * operation so a credential or environment change takes effect without a
 * reload; the provider snapshots it once per operation.
 *
 * @param ctx - the plugin context (owns the credentials seam and launch env).
 * @param config - the schema-validated plugin config.
 * @returns the fully resolved provider options.
 */
export function resolveProviderOptions(ctx: Context, config: Config): DifyHttpProviderOptions {
  const env = launchEnvironmentOf(ctx)
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
  const datasetId = config.datasetId !== undefined && config.datasetId.length > 0
    ? config.datasetId
    : env.get(DATASET_ID_ENV)?.value
  const user = config.user !== undefined && config.user.length > 0
    ? config.user
    : env.get(USER_ENV)?.value ?? DIFY_DEFAULT_USER
  return {
    ...config.apiKey !== undefined && config.apiKey.length > 0 ? { apiKey: config.apiKey } : {},
    resolveApiKey: async () => {
      // The managed store wins when mounted; otherwise the product trusts the
      // environment it was launched in.
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      const ambient = env.get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    baseURL: config.baseURL ?? env.get(BASE_URL_ENV)?.value ?? DIFY_DEFAULT_BASE_URL,
    user,
    ...datasetId !== undefined && datasetId.length > 0 ? { datasetId } : {},
  }
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
export function apply(ctx: Context, config: Config): void {
  let current = () => config
  installSettingsSection(ctx, DIFY_HTTP_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {},
  })
  ctx.dify.registerProvider(new DifyHttpProvider(() => resolveProviderOptions(ctx, current())))
}
