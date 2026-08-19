import { t as Schema } from "./lib.js";
import { n as DIFY_TOOL_SETTINGS_NAMESPACE, t as DIFY_HTTP_SETTINGS_NAMESPACE } from "./settings.js";
import { d as DIFY_DEFAULT_USER, i as DEFAULT_API_KEY_ENV, r as DATASET_ID_ENV, t as BASE_URL_ENV, u as DIFY_DEFAULT_BASE_URL } from "./http2.js";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
//#region src/config-page.ts
/**
* The configuration page served by `@deepseek-ai/dsh-dify/config`: one
* self-contained HTML document, no build step and no network origin but the
* host itself.
*
* The inline script deliberately avoids template literals: this whole document
* lives inside one, and nesting them would turn every interpolation into an
* escaping puzzle.
*
* @module @deepseek-ai/dsh-dify/config-page
*/
/** The complete configuration page, served verbatim at the plugin's route. */
const CONFIG_PAGE_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Dify</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f7f9;
    --panel: #ffffff;
    --border: #e3e5e9;
    --text: #1b1d21;
    --muted: #6b7280;
    --accent: #3b5bdb;
    --accent-text: #ffffff;
    --danger: #b42318;
    --ok: #12805c;
    --chip: #eef1f6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17181c;
      --panel: #1f2126;
      --border: #303338;
      --text: #e8eaed;
      --muted: #9aa1ab;
      --accent: #6b8afd;
      --accent-text: #101215;
      --danger: #f2807a;
      --ok: #52c1a0;
      --chip: #2a2d33;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 20px 64px;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", Roboto, sans-serif;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .lede { color: var(--muted); margin: 0 0 24px; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .card > h2 { font-size: 15px; margin: 0 0 2px; }
  .card > .sub { color: var(--muted); margin: 0 0 18px; font-size: 13px; }
  .field { margin-bottom: 18px; }
  .field:last-child { margin-bottom: 0; }
  .field-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  label { font-weight: 600; font-size: 13px; }
  .chip {
    font-size: 11px;
    color: var(--muted);
    background: var(--chip);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .chip.on { color: var(--ok); }
  input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }
  input:disabled { opacity: .6; }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .hint { color: var(--muted); font-size: 12px; margin-top: 6px; }
  .actions { display: flex; align-items: center; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
  button {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
  button:disabled { opacity: .5; cursor: default; }
  .status { flex: 1; min-width: 200px; font-size: 13px; color: var(--muted); }
  .status.err { color: var(--danger); }
  .status.ok { color: var(--ok); }
  .banner {
    border: 1px solid var(--border);
    border-left: 3px solid var(--danger);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
    font-size: 13px;
    display: none;
  }
  footer { color: var(--muted); font-size: 12px; margin-top: 20px; word-break: break-all; }
</style>
</head>
<body>
<main>
  <h1 id="t-title">Dify</h1>
  <p class="lede" id="t-lede"></p>

  <div class="banner" id="banner"></div>

  <section class="card">
    <h2 id="t-conn"></h2>
    <p class="sub" id="t-conn-sub"></p>

    <div class="field">
      <div class="field-head"><label for="apiKey" id="l-apiKey"></label><span class="chip" id="c-apiKey"></span></div>
      <input id="apiKey" type="password" autocomplete="off" spellcheck="false">
      <div class="hint" id="h-apiKey"></div>
    </div>

    <div class="field">
      <div class="field-head"><label for="apiKeyEnv" id="l-apiKeyEnv"></label><span class="chip" id="c-apiKeyEnv"></span></div>
      <input id="apiKeyEnv" type="text" autocomplete="off" spellcheck="false">
      <div class="hint" id="h-apiKeyEnv"></div>
    </div>

    <div class="field">
      <div class="field-head"><label for="baseURL" id="l-baseURL"></label><span class="chip" id="c-baseURL"></span></div>
      <input id="baseURL" type="text" autocomplete="off" spellcheck="false">
      <div class="hint" id="h-baseURL"></div>
    </div>

    <div class="field">
      <div class="field-head"><label for="user" id="l-user"></label><span class="chip" id="c-user"></span></div>
      <input id="user" type="text" autocomplete="off" spellcheck="false">
      <div class="hint" id="h-user"></div>
    </div>

    <div class="field">
      <div class="field-head"><label for="datasetId" id="l-datasetId"></label><span class="chip" id="c-datasetId"></span></div>
      <input id="datasetId" type="text" autocomplete="off" spellcheck="false">
      <div class="hint" id="h-datasetId"></div>
    </div>
  </section>

  <section class="card">
    <h2 id="t-tool"></h2>
    <p class="sub" id="t-tool-sub"></p>

    <div class="field">
      <div class="field-head"><label for="timeoutMs" id="l-timeoutMs"></label><span class="chip" id="c-timeoutMs"></span></div>
      <input id="timeoutMs" type="number" step="1000" min="1">
      <div class="hint" id="h-timeoutMs"></div>
    </div>
  </section>

  <div class="actions">
    <button class="primary" id="save"></button>
    <button id="revert"></button>
    <button id="probe"></button>
    <span class="status" id="status"></span>
  </div>

  <footer id="footer"></footer>
</main>

<script>
(function () {
  var ZH = String(navigator.language || 'en').toLowerCase().indexOf('zh') === 0;
  var T = ZH ? {
    lede: '这些参数保存在 DSH 的用户设置与凭据存储中，保存后对下一次调用立即生效。',
    conn: 'Dify 连接',
    connSub: 'Dify Service API 的地址与访问凭据。',
    tool: 'Dify 工具',
    toolSub: '模型单次调用的超时预算。',
    apiKey: 'API Key',
    apiKeyHint: '不写入设置文件，保存到凭据存储。留空表示保持当前密钥。',
    apiKeyConfigured: '已配置密钥。',
    apiKeyMissing: '尚未配置密钥。',
    apiKeyShadowed: '当前密钥来自启动环境（只读），此处无法改写；请修改环境变量后重启 dsh。',
    apiKeyNoService: '本部署未挂载凭据服务，无法在此保存密钥。',
    apiKeyEnv: '凭据引用名',
    apiKeyEnvHint: '密钥在凭据存储中的键名，也是回落到环境变量时读取的变量名。',
    baseURL: '接口地址',
    baseURLHint: 'Dify Service API 基址，其后追加 /chat-messages 等路径。留空则使用 $DIFY_BASE_URL 或默认地址。',
    user: '终端用户标识',
    userHint: 'Dify 要求每个请求带 user 字段。留空则使用 $DIFY_USER 或默认值 dsh-user。',
    datasetId: '默认数据集 ID',
    datasetIdHint: 'dify_retrieve 在未指定 datasetId 时使用此值。留空则使用 $DIFY_DATASET_ID。',
    timeoutMs: '超时（毫秒）',
    timeoutMsHint: '单次调用的超时预算。该值在工具注册时读取，改动需重启 dsh 后生效。',
    save: '保存',
    revert: '放弃修改',
    probe: '测试连接',
    saving: '正在保存…',
    saved: '已保存。',
    probing: '正在向 Dify 发起一次对话…',
    inherited: '继承',
    overridden: '已覆盖',
    empty: '留空表示继承',
    loadFailed: '读取当前配置失败：',
    saveFailed: '保存失败：',
    probeOk: '连接正常，Dify 返回了回答。',
    probeEmpty: '连接正常，但未返回回答。',
    probeFailed: '测试失败：',
    noSettings: '本部署未挂载设置服务，页面只读；请改用 cordis.patch.yml 或环境变量。',
    noSection: '对应的插件行未装载，这一节暂不可编辑。',
    effective: '当前生效：',
    fromEnv: '来自环境变量 ',
    docPath: '设置文件：',
    badNumber: '请填写合法数字：'
  } : {
    lede: 'These values live in DSH user settings and the credential store; a save applies to the next call.',
    conn: 'Dify connection',
    connSub: 'The Dify Service API endpoint and credentials.',
    tool: 'Dify tool',
    toolSub: 'How long one model call may take.',
    apiKey: 'API key',
    apiKeyHint: 'Never written to a settings file; stored in the credential store. Leave empty to keep the current key.',
    apiKeyConfigured: 'A key is configured.',
    apiKeyMissing: 'No key configured yet.',
    apiKeyShadowed: 'The current key comes from the launch environment (read-only). Change the variable and restart dsh.',
    apiKeyNoService: 'This deployment mounts no credential provider, so no key can be saved here.',
    apiKeyEnv: 'Credential reference',
    apiKeyEnvHint: 'Key name in the credential store, and the environment variable read when falling back to it.',
    baseURL: 'Endpoint',
    baseURLHint: 'Dify Service API base; /chat-messages etc. are appended. Empty falls back to $DIFY_BASE_URL, then the default.',
    user: 'End-user identifier',
    userHint: 'Dify requires a user field on every request. Empty uses $DIFY_USER or the default dsh-user.',
    datasetId: 'Default dataset id',
    datasetIdHint: 'Used by dify_retrieve when no datasetId is given. Empty uses $DIFY_DATASET_ID.',
    timeoutMs: 'Timeout (ms)',
    timeoutMsHint: 'Budget for one call. Read when the tool registers, so a change applies after restarting dsh.',
    save: 'Save',
    revert: 'Discard changes',
    probe: 'Test connection',
    saving: 'Saving...',
    saved: 'Saved.',
    probing: 'Sending a chat to Dify...',
    inherited: 'inherited',
    overridden: 'overridden',
    empty: 'empty = inherit',
    loadFailed: 'Could not read the current configuration: ',
    saveFailed: 'Save failed: ',
    probeOk: 'Connection works; Dify returned an answer.',
    probeEmpty: 'Connection works, but no answer was returned.',
    probeFailed: 'Test failed: ',
    noSettings: 'This deployment mounts no settings provider; the page is read-only. Use cordis.patch.yml or environment variables.',
    noSection: 'The owning plugin row is not loaded, so this section cannot be edited.',
    effective: 'in effect: ',
    fromEnv: 'from environment variable ',
    docPath: 'Settings file: ',
    badNumber: 'Not a valid number: '
  };

  var PROVIDER_TEXT = ['apiKeyEnv', 'baseURL', 'user', 'datasetId'];
  var TOOL_NUM = ['timeoutMs'];
  var ALL = PROVIDER_TEXT.concat(TOOL_NUM);

  var base = location.pathname.replace(/\\/+$/, '');
  var state = null;
  var el = function (id) { return document.getElementById(id); };

  function setStatus(message, kind) {
    var node = el('status');
    node.textContent = message || '';
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  function labels() {
    el('t-lede').textContent = T.lede;
    el('t-conn').textContent = T.conn;
    el('t-conn-sub').textContent = T.connSub;
    el('t-tool').textContent = T.tool;
    el('t-tool-sub').textContent = T.toolSub;
    el('save').textContent = T.save;
    el('revert').textContent = T.revert;
    el('probe').textContent = T.probe;
    el('l-apiKey').textContent = T.apiKey;
    for (var i = 0; i < ALL.length; i++) {
      var key = ALL[i];
      el('l-' + key).textContent = T[key];
      el('h-' + key).textContent = T[key + 'Hint'];
    }
  }

  function chip(key, section) {
    var node = el('c-' + key);
    if (!section.available) { node.textContent = ''; return; }
    var owned = section.overridden.indexOf(key) >= 0;
    node.textContent = owned ? T.overridden : T.inherited;
    node.className = 'chip';
  }

  function inheritedText(section, key) {
    var value = section.value[key];
    if (value === undefined || value === null || value === '') return T.empty;
    return String(value);
  }

  function fill(key, section) {
    var input = el(key);
    var owned = section.available && section.overridden.indexOf(key) >= 0;
    input.value = owned ? String(section.value[key]) : '';
    input.placeholder = owned ? '' : inheritedText(section, key);
    input.disabled = !section.available || !state.settingsAvailable;
    chip(key, section);
  }

  function render() {
    var provider = state.provider;
    var tool = state.tool;

    for (var i = 0; i < PROVIDER_TEXT.length; i++) fill(PROVIDER_TEXT[i], provider);
    for (var m = 0; m < TOOL_NUM.length; m++) fill(TOOL_NUM[m], tool);

    if (provider.available && provider.overridden.indexOf('baseURL') < 0) {
      el('baseURL').placeholder = state.effective.baseURL;
    }

    var apiKey = el('apiKey');
    apiKey.value = '';
    apiKey.disabled = !state.credentialsAvailable || !state.credential.writable;
    var keyChip = el('c-apiKey');
    keyChip.textContent = state.credential.configured ? T.apiKeyConfigured : T.apiKeyMissing;
    keyChip.className = 'chip' + (state.credential.configured ? ' on' : '');
    var keyHint = T.apiKeyHint;
    if (!state.credentialsAvailable) keyHint = T.apiKeyNoService;
    else if (!state.credential.writable) keyHint = T.apiKeyShadowed;
    el('h-apiKey').textContent = keyHint + ' (' + state.credential.ref + ')';

    var baseHint = T.baseURLHint + ' ' + T.effective + state.effective.baseURL;
    if (state.env.baseURL) baseHint += ' \\u00b7 ' + T.fromEnv + 'DIFY_BASE_URL';
    el('h-baseURL').textContent = baseHint;

    var banner = el('banner');
    var warning = '';
    if (!state.settingsAvailable) warning = T.noSettings;
    else if (!provider.available || !tool.available) warning = T.noSection;
    banner.textContent = warning;
    banner.style.display = warning ? 'block' : 'none';

    el('save').disabled = !state.settingsAvailable && !state.credentialsAvailable;
    el('footer').textContent = state.documentPath ? T.docPath + state.documentPath : '';
  }

  function textOf(key) {
    var raw = el(key).value.trim();
    return raw === '' ? null : raw;
  }

  function numberOf(key) {
    var raw = el(key).value.trim();
    if (raw === '') return null;
    var value = Number(raw);
    if (!isFinite(value)) throw new Error(T.badNumber + T[key]);
    return value;
  }

  function collect() {
    var body = {};
    if (state.provider.available && state.settingsAvailable) {
      var fields = {};
      for (var i = 0; i < PROVIDER_TEXT.length; i++) fields[PROVIDER_TEXT[i]] = textOf(PROVIDER_TEXT[i]);
      body.provider = { revision: state.provider.revision, fields: fields };
    }
    if (state.tool.available && state.settingsAvailable) {
      var toolFields = {};
      for (var m = 0; m < TOOL_NUM.length; m++) toolFields[TOOL_NUM[m]] = numberOf(TOOL_NUM[m]);
      body.tool = { revision: state.tool.revision, fields: toolFields };
    }
    var apiKey = el('apiKey').value.trim();
    if (apiKey !== '') body.apiKey = apiKey;
    return body;
  }

  function post(path, body) {
    return fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }

  function load() {
    return fetch(base + '/state', { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      state = data;
      render();
    });
  }

  el('save').addEventListener('click', function () {
    var body;
    try {
      body = collect();
    } catch (error) {
      setStatus(error.message, 'err');
      return;
    }
    setStatus(T.saving);
    el('save').disabled = true;
    post('/save', body).then(function (data) {
      state = data.state;
      render();
      setStatus(T.saved, 'ok');
    }).catch(function (error) {
      setStatus(T.saveFailed + error.message, 'err');
    }).then(function () {
      el('save').disabled = false;
    });
  });

  el('revert').addEventListener('click', function () {
    setStatus('');
    render();
  });

  el('probe').addEventListener('click', function () {
    setStatus(T.probing);
    el('probe').disabled = true;
    post('/probe', { query: 'ping' }).then(function (data) {
      if (data.ok) setStatus(T.probeOk, 'ok');
      else setStatus(T.probeEmpty, 'ok');
    }).catch(function (error) {
      setStatus(T.probeFailed + error.message, 'err');
    }).then(function () {
      el('probe').disabled = false;
    });
  });

  labels();
  load().catch(function (error) {
    setStatus(T.loadFailed + error.message, 'err');
  });
})();
<\/script>
</body>
</html>
`;
//#endregion
//#region src/config.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "dify-config";
/** The HTTP carrier this page mounts on; absent in headless/TUI compositions. */
const inject = ["webServer"];
/** Largest accepted request body; the page posts a handful of scalar fields. */
const MAX_BODY_BYTES = 65536;
/** Default mount path of the configuration page. */
const DEFAULT_CONFIG_PATH = "/dify";
const Config = Schema.object({ path: Schema.string().default(DEFAULT_CONFIG_PATH) });
/**
* The provider fields this page edits. `apiKey` is deliberately absent: a
* literal secret in the settings document is exactly what the credential seam
* exists to avoid, so the page writes the key through `ctx.credentials`.
*/
const PROVIDER_FIELDS = {
	apiKeyEnv: "string",
	baseURL: "string",
	user: "string",
	datasetId: "string"
};
/** The tool fields this page edits. */
const TOOL_FIELDS = { timeoutMs: "number" };
/** A refusal carrying the status the route answers with. */
var ConfigRequestError = class extends Error {
	status;
	code;
	constructor(status, message, code = "REQUEST_REJECTED") {
		super(message);
		this.status = status;
		this.code = code;
	}
};
/** Whether a hostname names this machine's loopback interface. */
function isLoopbackHostname(hostname) {
	const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
	if (bare === "localhost" || bare === "::1" || bare === "0:0:0:0:0:0:0:1") return true;
	return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare);
}
/** Parse a `Host`-style authority into its hostname, or undefined when unusable. */
function authorityHostname(authority) {
	if (authority === void 0 || authority.length === 0) return void 0;
	try {
		return new URL(`http://${authority}`).hostname;
	} catch {
		return;
	}
}
/**
* Apply the request fence. Throws {@link ConfigRequestError} carrying the status
* the caller answers with; returns normally when the request may proceed.
*/
function assertRequestAllowed(req, mutating) {
	const hostname = authorityHostname(req.headers.host);
	if (hostname === void 0 || !isLoopbackHostname(hostname)) throw new ConfigRequestError(403, "the Dify configuration page is served on loopback only", "NOT_LOOPBACK");
	if (!mutating) return;
	if ((req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() !== "application/json") throw new ConfigRequestError(415, "expected an application/json request body", "BAD_MEDIA_TYPE");
	const origin = req.headers.origin;
	if (origin === void 0 || origin === "null") return;
	let originUrl;
	try {
		originUrl = new URL(origin);
	} catch {
		throw new ConfigRequestError(403, `unusable Origin header "${origin}"`, "BAD_ORIGIN");
	}
	if (originUrl.host !== req.headers.host || !isLoopbackHostname(originUrl.hostname)) throw new ConfigRequestError(403, `Origin "${origin}" does not match this authority`, "BAD_ORIGIN");
}
/** Project one settings descriptor into the page's section view. */
function sectionOf(descriptor) {
	if (descriptor === void 0) return {
		available: false,
		revision: 0,
		value: {},
		overridden: []
	};
	const user = descriptor.user;
	return {
		available: true,
		revision: descriptor.revision,
		value: descriptor.value ?? {},
		overridden: user !== null && typeof user === "object" ? Object.keys(user) : []
	};
}
/**
* Turn one submitted section into path edits.
*/
function planSectionOps(fields, allowed) {
	const ops = [];
	for (const [key, value] of Object.entries(fields)) {
		const kind = allowed[key];
		if (kind === void 0) throw new ConfigRequestError(400, `unknown field "${key}"`, "UNKNOWN_FIELD");
		if (value === null || value === void 0) {
			ops.push({
				op: "unset",
				path: [key]
			});
			continue;
		}
		assertFieldKind(key, kind, value);
		ops.push({
			op: "set",
			path: [key],
			value
		});
	}
	return ops;
}
/** Reject a wire value whose type the schema would only discover later. */
function assertFieldKind(key, kind, value) {
	if (!(kind === "string" ? typeof value === "string" : typeof value === "number" && Number.isFinite(value))) throw new ConfigRequestError(400, `field "${key}" expects ${kind}`, "BAD_FIELD_TYPE");
}
/** Validate the submitted shape before any of it reaches the settings seam. */
function parseSaveRequest(body) {
	if (body === null || typeof body !== "object" || Array.isArray(body)) throw new ConfigRequestError(400, "expected a JSON object body", "BAD_BODY");
	const raw = body;
	const section = (key) => {
		const value = raw[key];
		if (value === void 0 || value === null) return void 0;
		if (typeof value !== "object" || Array.isArray(value)) throw new ConfigRequestError(400, `"${key}" must be an object`, "BAD_BODY");
		const { revision, fields } = value;
		if (typeof revision !== "number" || !Number.isInteger(revision)) throw new ConfigRequestError(400, `"${key}.revision" must be an integer`, "BAD_BODY");
		if (fields === null || typeof fields !== "object" || Array.isArray(fields)) throw new ConfigRequestError(400, `"${key}.fields" must be an object`, "BAD_BODY");
		return {
			revision,
			fields
		};
	};
	const apiKey = raw["apiKey"];
	if (apiKey !== void 0 && apiKey !== null && typeof apiKey !== "string") throw new ConfigRequestError(400, "\"apiKey\" must be a string", "BAD_BODY");
	const provider = section("provider");
	const tool = section("tool");
	return {
		...provider === void 0 ? {} : { provider },
		...tool === void 0 ? {} : { tool },
		...typeof apiKey === "string" ? { apiKey } : {}
	};
}
/** Read a bounded JSON body, rejecting anything past {@link MAX_BODY_BYTES}. */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
		size += buffer.byteLength;
		if (size > 65536) throw new ConfigRequestError(413, "request body is too large", "BODY_TOO_LARGE");
		chunks.push(buffer);
	}
	if (size === 0) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new ConfigRequestError(400, "request body is not valid JSON", "BAD_JSON");
	}
}
/** Collect everything one page render needs from the mounted services. */
async function buildState(ctx) {
	const settings = ctx.get("settings");
	const credentials = ctx.get("credentials");
	const descriptors = settings?.describe({ redactSecrets: true }) ?? [];
	const find = (ns) => descriptors.find((entry) => String(entry.ns) === ns);
	const provider = sectionOf(find(String(DIFY_HTTP_SETTINGS_NAMESPACE)));
	const tool = sectionOf(find(String(DIFY_TOOL_SETTINGS_NAMESPACE)));
	const env = launchEnvironmentOf(ctx);
	const envBaseURL = env.get(BASE_URL_ENV)?.value;
	const envDatasetId = env.get(DATASET_ID_ENV)?.value;
	const configuredApiKeyEnv = provider.value["apiKeyEnv"];
	const apiKeyEnv = typeof configuredApiKeyEnv === "string" && configuredApiKeyEnv.length > 0 ? configuredApiKeyEnv : DEFAULT_API_KEY_ENV;
	const info = credentials === void 0 ? void 0 : await credentials.describe(credentialRef(apiKeyEnv));
	const configuredBaseURL = provider.value["baseURL"];
	const configuredUser = provider.value["user"];
	const configuredDatasetId = provider.value["datasetId"];
	return {
		provider,
		tool,
		credential: {
			ref: apiKeyEnv,
			configured: info?.configured ?? false,
			writable: info?.writable ?? false,
			...info?.source === void 0 ? {} : { source: info.source }
		},
		env: {
			...envBaseURL === void 0 ? {} : { baseURL: envBaseURL },
			...envDatasetId === void 0 ? {} : { datasetId: envDatasetId }
		},
		effective: {
			baseURL: typeof configuredBaseURL === "string" && configuredBaseURL.length > 0 ? configuredBaseURL : envBaseURL ?? "https://api.dify.ai/v1",
			user: typeof configuredUser === "string" && configuredUser.length > 0 ? configuredUser : DIFY_DEFAULT_USER,
			...typeof configuredDatasetId === "string" && configuredDatasetId.length > 0 ? { datasetId: configuredDatasetId } : envDatasetId !== void 0 ? { datasetId: envDatasetId } : {}
		},
		defaults: {
			baseURL: DIFY_DEFAULT_BASE_URL,
			user: DIFY_DEFAULT_USER,
			apiKeyEnv: DEFAULT_API_KEY_ENV
		},
		settingsAvailable: settings !== void 0,
		credentialsAvailable: credentials !== void 0,
		...settings?.documentPath === void 0 ? {} : { documentPath: settings.documentPath }
	};
}
/** The machine code a thrown value carries, when it carries one. */
function codeOf(error) {
	const raw = error?.code;
	return typeof raw === "string" ? raw : void 0;
}
/**
* Map a settings-seam refusal to the answer the page acts on.
*/
function settingsWriteError(error) {
	if (codeOf(error) === "SETTINGS_CONFLICT") return new ConfigRequestError(409, "the settings document changed since this page loaded; reload and reapply", "SETTINGS_CONFLICT");
	return new ConfigRequestError(400, error instanceof Error ? error.message : String(error), "SETTINGS_REJECTED");
}
/** Run one section write, translating every seam refusal into a page answer. */
async function writeSection(settings, section, ns, allowed) {
	const ops = planSectionOps(section.fields, allowed);
	try {
		await settings.mutate(ns, ops, section.revision);
	} catch (error) {
		throw settingsWriteError(error);
	}
}
/**
* Apply one submitted form: the settings edits first (each fenced by the
* revision the page read), then the credential.
*/
async function applySave(ctx, request) {
	const settings = ctx.get("settings");
	if (request.provider !== void 0 || request.tool !== void 0) {
		if (settings === void 0) throw new ConfigRequestError(503, "this deployment mounts no settings provider, so values cannot be saved", "SETTINGS_ABSENT");
		if (request.provider !== void 0) await writeSection(settings, request.provider, DIFY_HTTP_SETTINGS_NAMESPACE, PROVIDER_FIELDS);
		if (request.tool !== void 0) await writeSection(settings, request.tool, DIFY_TOOL_SETTINGS_NAMESPACE, TOOL_FIELDS);
	}
	const apiKey = request.apiKey?.trim();
	if (apiKey === void 0 || apiKey.length === 0) return;
	const credentials = ctx.get("credentials");
	if (credentials === void 0) throw new ConfigRequestError(503, "this deployment mounts no credential provider, so the API key cannot be saved", "CREDENTIALS_ABSENT");
	const resolved = settings?.get(DIFY_HTTP_SETTINGS_NAMESPACE);
	try {
		await credentials.set(credentialRef(resolved?.apiKeyEnv ?? "DIFY_API_KEY"), apiKey);
	} catch (error) {
		throw new ConfigRequestError(400, error instanceof Error ? error.message : String(error), "CREDENTIAL_REJECTED");
	}
}
/** Run one live chat so the page can report whether the settings work. */
async function runProbe(ctx, query) {
	const dify = ctx.get("dify");
	if (dify === void 0) throw new ConfigRequestError(503, "the dify service is not mounted in this composition", "DIFY_ABSENT");
	return { answered: (await dify.chat({ query }, AbortSignal.timeout(3e4))).answer.length > 0 };
}
/** Map a thrown value to the status and body the endpoints answer with. */
function errorResponse(error) {
	if (error instanceof ConfigRequestError) return {
		status: error.status,
		body: {
			error: error.message,
			code: error.code
		}
	};
	if (codeOf(error) === "SETTINGS_CONFLICT") return {
		status: 409,
		body: {
			error: "the settings document changed since this page loaded; reload and reapply",
			code: "SETTINGS_CONFLICT"
		}
	};
	return {
		status: 400,
		body: {
			error: error instanceof Error ? error.message : String(error),
			code: codeOf(error) ?? "INTERNAL"
		}
	};
}
/** Send one JSON response with caching disabled. */
function sendJson(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(body));
}
/**
* Mount the configuration page and its JSON endpoints under `config.path`.
*/
function apply(ctx, config) {
	const base = (config.path ?? "/dify").replace(/\/+$/, "") || "/dify";
	const handler = async (req, res) => {
		const route = new URL(req.url ?? "/", "http://x").pathname.slice(base.length) || "/";
		try {
			if (route === "/" || route === "/index.html") {
				assertRequestAllowed(req, false);
				if (req.method !== "GET" && req.method !== "HEAD") throw new ConfigRequestError(405, "method not allowed", "BAD_METHOD");
				res.writeHead(200, {
					"content-type": "text/html; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end(req.method === "HEAD" ? void 0 : CONFIG_PAGE_HTML);
				return;
			}
			if (route === "/state") {
				assertRequestAllowed(req, false);
				if (req.method !== "GET") throw new ConfigRequestError(405, "method not allowed", "BAD_METHOD");
				sendJson(res, 200, await buildState(ctx));
				return;
			}
			if (route === "/save") {
				if (req.method !== "POST") throw new ConfigRequestError(405, "method not allowed", "BAD_METHOD");
				assertRequestAllowed(req, true);
				await applySave(ctx, parseSaveRequest(await readJsonBody(req)));
				sendJson(res, 200, {
					saved: true,
					state: await buildState(ctx)
				});
				return;
			}
			if (route === "/probe") {
				if (req.method !== "POST") throw new ConfigRequestError(405, "method not allowed", "BAD_METHOD");
				assertRequestAllowed(req, true);
				const body = await readJsonBody(req);
				sendJson(res, 200, {
					ok: true,
					...await runProbe(ctx, typeof body.query === "string" && body.query.trim().length > 0 ? body.query.trim() : "ping")
				});
				return;
			}
			throw new ConfigRequestError(404, "no such endpoint", "NOT_FOUND");
		} catch (error) {
			if (res.headersSent) {
				res.end();
				return;
			}
			const { status, body } = errorResponse(error);
			sendJson(res, status, body);
		}
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: base,
		handler
	}), "dify-config: page route");
	ctx.logger.info("Dify configuration page: http://127.0.0.1:%d%s", ctx.webServer.port, base);
}
//#endregion
export { Config, ConfigRequestError, DEFAULT_CONFIG_PATH, MAX_BODY_BYTES, PROVIDER_FIELDS, TOOL_FIELDS, apply, applySave, assertRequestAllowed, authorityHostname, buildState, codeOf, errorResponse, inject, isLoopbackHostname, name, parseSaveRequest, planSectionOps, readJsonBody, runProbe, sectionOf };
