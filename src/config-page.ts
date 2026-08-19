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
export const CONFIG_PAGE_HTML = `<!doctype html>
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
</script>
</body>
</html>
`
