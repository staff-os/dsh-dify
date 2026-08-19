# dsh-dify

English | [中文](README.zh.md)

Dify agent and knowledge-base capability for the [DeepSeek Harness](https://deepseekdocs.com). It gives the
agent two tools — `dify_chat` that calls a Dify agent app, and `dify_retrieve` that queries a Dify knowledge
base (dataset) for relevant chunks.

## Design

The package follows the Harness [three-role capability
pattern](https://deepseekdocs.com/docs/learn/dev/practice): one seam, one provider, one consumer —
shipped as one package with four plugin entry points (the fourth is the configuration page over the
same values), so a profile can override, replace, or drop any single role without touching the
others.

| Role | Module | Plugin name | Responsibility |
|---|---|---|---|
| Service Definition | [src/index.ts](src/index.ts) | `@deepseek-ai/dsh-dify` | Owns `ctx.dify`: provider registry, order-independent selection |
| Service Provider | [src/http.ts](src/http.ts) | `@deepseek-ai/dsh-dify/http` | Calls Dify Service API (`/chat-messages`, `/datasets/{id}/retrieve`), resolves credentials, normalizes results |
| Consumer | [src/tool.ts](src/tool.ts) | `@deepseek-ai/dsh-dify/tool` | The model-facing tools: `dify_chat`, `dify_retrieve` — schema, prompt guidance, presentation |
| Consumer | [src/config.ts](src/config.ts) | `@deepseek-ai/dsh-dify/config` | The person-facing configuration page over the same settings and credential seams |

The provider and the consumer depend only on the Service Definition, never on each other. Replacing
the backend means replacing one row:

```yaml
- id: dify-http
  name: 'your-own-dify-provider'
```

## Prerequisites

1. **A running Dify instance** — self-hosted or cloud. Defaults to `https://api.dify.ai/v1`.
2. **A Dify API key** — create one for your app in Dify.
3. **A Dify agent app** — for `dify_chat` to call.
4. **A Dify knowledge base (dataset)** — for `dify_retrieve` to query. At least one dataset id must
   be configured.

## Install

```sh
dsh plugin --profile web add "github:staff-os/dsh-dify#main"
```

`dsh plugin add` forwards the source to pnpm as-is, so any pnpm-recognized source works:

```sh
dsh plugin --profile web add link:/path/to/dsh-dify   # local development
```

`lib/` is committed, so no build script runs at install time and pnpm needs no build allowance.
Restart `dsh web` afterwards, then verify the four rows landed:

```sh
dsh --profile web --dump-config | grep dify
```

## Configure

Three ways in, one set of values. The configuration page is the easy one; the environment and the
YAML rows remain exactly what they were.

### The configuration page

With `dsh web` running, open **http://127.0.0.1:3080/dify** (whatever port the web surface
printed). It edits the endpoint, the default dataset, and the tool timeout, and it stores the API
key through the credential service — the key never reaches a settings file, and the field reports
only whether one is configured.

Every field is *leave empty to inherit*: the box holds your own override, the placeholder names the
value in effect without one. Clearing a box is how a field goes back to inheriting the composition
row, the environment variable, or the schema default. **Test connection** runs one live chat so a
saved endpoint can be confirmed rather than assumed.

The page is served on loopback only, whatever `dsh web --host` binds, because it reads deployment
configuration and writes a credential. Move it with the row's `path`, or take it out entirely:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dify-config
  disabled: true
```

### Environment variables

Set the environment the plugin reads — no YAML and no page needed for the common case:

```sh
export DIFY_API_KEY=app-xxx
export DIFY_BASE_URL=https://your-dify-host/v1     # optional, defaults to https://api.dify.ai/v1
export DIFY_DATASET_ID=dataset_id_1                 # required for dify_retrieve unless set in YAML
export DIFY_USER=end-user-id                        # optional, defaults to dsh-user
```

The API key resolves through the DSH credentials service when one is mounted
(`~/.dsh/.credentials.yaml`), and through the launch environment otherwise. Never inline a key in a
config file.

### `@deepseek-ai/dsh-dify` (seam)

| Config | Default | Description |
|---|---|---|
| `provider` | auto | Provider id to pin. Unset auto-selects when exactly one is usable. Also `$DSH_DIFY_PROVIDER`. |

### `@deepseek-ai/dsh-dify/http` (provider)

| Config | Default | Description |
|---|---|---|
| `apiKey` | — | Literal key. Prefer `apiKeyEnv`. |
| `apiKeyEnv` | `DIFY_API_KEY` | Credential reference resolved per operation. |
| `baseURL` | `$DIFY_BASE_URL` → `https://api.dify.ai/v1` | Endpoint base; `/chat-messages` and `/datasets/...` are appended. |
| `user` | `$DIFY_USER` → `dsh-user` | Dify end-user identifier sent on every request. |
| `datasetId` | `$DIFY_DATASET_ID` | Default dataset for `dify_retrieve`. |

### `@deepseek-ai/dsh-dify/tool` (consumer)

| Config | Default | Description |
|---|---|---|
| `timeoutMs` | `60000` | Cooperative per-call timeout budget. Read at registration: a change applies at the next start. |

### `@deepseek-ai/dsh-dify/config` (configuration page)

| Config | Default | Description |
|---|---|---|
| `path` | `/dify` | Pathname the page and its JSON endpoints (`/state`, `/save`, `/probe`) are served under. |

## Call flow

### dify_chat

1. The model calls `dify_chat` with a `query` and optional `conversationId`.
2. The tool validates it and calls `ctx.dify.chat({ query, conversationId }, signal)`.
3. The seam selects the usable provider and forwards the request.
4. The provider posts to `POST /chat-messages` in blocking mode.
5. The tool renders the answer text.

### dify_retrieve

1. The model calls `dify_retrieve` with a `query` and optional `datasetId`.
2. The tool validates it and calls `ctx.dify.retrieve({ query, datasetId }, signal)`.
3. The seam selects the usable provider and forwards the request.
4. The provider posts to `POST /datasets/{id}/retrieve` and normalizes `records[]`.
5. The tool renders the chunks as cited text plus structured metadata.

An empty result is a result: the tool tells the model the knowledge base has nothing relevant and
not to invent a citation.

## Develop

```sh
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm build       # tsdown → lib/{index,http,tool,config}.js
```

`lib/` is committed; rebuild and commit it with any `src/` change.

## Dify API reference

- [Agent API](https://docs.dify.ai/zh/api-reference/guides/agent)
- [Chat Messages](https://docs.dify.ai/zh/api-reference/llm-app/chat-messages)
- [Knowledge Base Retrieval](https://docs.dify.ai/zh/api-reference/knowledge-base/retrieve)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DIFY_SCOPE_MISSING` | No dataset id in scope | Set `datasetId` or `$DIFY_DATASET_ID` |
| `DIFY_PROVIDER_CREDENTIAL_MISSING` | No key for the credential reference | Set `$DIFY_API_KEY`, or match `apiKeyEnv` to your credentials key |
| `DIFY_PROVIDER_UNAUTHORIZED` | Dify rejected the key | Reissue the key in Dify |
| `DIFY_PROVIDER_UNAVAILABLE` | Provider row missing or its options invalid | Check `--dump-config` for the `dify-http` row |
| `DIFY_PROVIDER_AMBIGUOUS` | Two usable providers registered | Pin one with the seam's `provider` |
| `dify_chat` / `dify_retrieve` absent from the tool list | Bundle not loaded | `dsh --dump-config \| grep dify`; restart `dsh web` |
| The page answers `NOT_LOOPBACK` | Reached over a LAN address | Open it from the host itself, or tunnel the port |
| The page answers `SETTINGS_CONFLICT` | The settings document moved since the page loaded | Reload the page and reapply |

## Known limitations

- Blocking mode only — no SSE streaming. The full response is awaited.
- `dify_chat` does not forward file inputs or vision attachments.
- `dify_retrieve` does not support multi-dataset search or `attachment_ids`.
- The configuration page does not list available Dify apps or datasets for selection.
