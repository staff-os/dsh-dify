import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/settings.ts
/**
* The settings namespaces this package owns, plus the layering rule every
* consumer of them follows.
*
* A namespace is named after the plugin row that owns it (`dify-http`,
* `tool-dify`), because a configuration surface addresses the ROW a value
* belongs to, not the module that happens to read it. Each owner registers its
* own plugin `Config` schema through `installSettingsSection`, so the layers
* resolve as: schema defaults, then the composition entry (`cordis.patch.yml`),
* then the user's `~/.dsh/settings.yaml` section. The launch-environment
* fallbacks (`$DIFY_BASE_URL`, `$DIFY_API_KEY`, `$DIFY_DATASET_ID`) stay where
* they already were — inside the provider's option resolution — so an absent
* field still falls through to the environment rather than to a hidden fourth
* layer here.
*
* A deployment that mounts no settings provider keeps working: registration
* rides the settings service's presence, and every reader falls back to its
* composition entry.
*
* @module @deepseek-ai/dsh-dify/settings
*/
/** Settings namespace owned by the `dify-http` provider row. */
const DIFY_HTTP_SETTINGS_NAMESPACE = settingsNamespace("dify-http");
/** Settings namespace owned by the `tool-dify` consumer row. */
const DIFY_TOOL_SETTINGS_NAMESPACE = settingsNamespace("tool-dify");
//#endregion
export { DIFY_TOOL_SETTINGS_NAMESPACE as n, DIFY_HTTP_SETTINGS_NAMESPACE as t };
