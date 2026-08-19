# dsh-dify

[English](README.md) | 中文

为 [DeepSeek Harness](https://deepseekdocs.com) 提供 Dify 智能体与知识库能力。它给智能体注册两个
工具：`dify_chat` 调用 Dify 中定义的智能体应用，`dify_retrieve` 检索 Dify 知识库（数据集）中的
相关文本块。

## 设计

本包遵循 Harness 的[三角色能力模式](https://deepseekdocs.com/docs/learn/dev/practice)：一个接缝、
一个提供方、一个消费方 —— 以单个包、四个插件入口交付（第四个是面向人的配置页，改的仍是同一批值），
因此 profile 可以单独覆盖、替换或摘掉其中任一角色，而不影响其余几个。

| 角色 | 模块 | 插件名 | 职责 |
|---|---|---|---|
| Service Definition | [src/index.ts](src/index.ts) | `@deepseek-ai/dsh-dify` | 持有 `ctx.dify`：提供方注册表、与注册顺序无关的选择 |
| Service Provider | [src/http.ts](src/http.ts) | `@deepseek-ai/dsh-dify/http` | 调用 Dify Service API（`/chat-messages`、`/datasets/{id}/retrieve`）、解析凭据、归一化结果 |
| Consumer | [src/tool.ts](src/tool.ts) | `@deepseek-ai/dsh-dify/tool` | 面向模型的工具：`dify_chat`、`dify_retrieve` —— 参数模式、提示词引导、展示 |
| Consumer | [src/config.ts](src/config.ts) | `@deepseek-ai/dsh-dify/config` | 面向人的配置页：读写同一批 settings 分节与凭据引用 |

提供方与消费方都只依赖 Service Definition，彼此互不依赖。更换后端只需替换一行：

```yaml
- id: dify-http
  name: 'your-own-dify-provider'
```

## 前置条件

1. **一个运行中的 Dify 实例** —— 自建或云端，默认连接 `https://api.dify.ai/v1`。
2. **一个 Dify API Key** —— 在 Dify 中为你的应用创建。
3. **一个 Dify 智能体应用** —— 供 `dify_chat` 调用。
4. **一个 Dify 知识库（数据集）** —— 供 `dify_retrieve` 检索。至少需要配置一个数据集 id。

## 安装

```sh
dsh plugin --profile web add "github:deepseek-ai/dsh-dify#main"
```

`dsh plugin add` 会把来源原样交给 pnpm，因此任何 pnpm 认识的来源都可以：

```sh
dsh plugin --profile web add link:/path/to/dsh-dify   # 本地开发
```

`lib/` 已随仓库提交，安装期不执行构建脚本，也就不需要 pnpm 的 build 授权。安装后**重启 `dsh web`**，
再确认四行都已插入：

```sh
dsh --profile web --dump-config | grep dify
```

## 配置

三个入口，同一批值。配置页是最省事的那个；环境变量与 YAML 行的行为一如从前。

### 配置页

`dsh web` 运行时，打开 **http://127.0.0.1:3080/dify**（端口以 web 界面启动时打印的为准）。页面可
以配置接口地址、默认数据集、工具超时；API Key 通过凭据服务保存，不会写进任何设置文件，字段
本身只报告"是否已配置"。

每个字段都是**留空即继承**：输入框里放的是你自己的覆盖值，占位符显示的是没有覆盖时实际生效的值。
把输入框清空，就是让该字段重新继承组装行、环境变量或 schema 默认值。**测试连接**会真的向 Dify
发起一次对话，配完不必靠猜。

无论 `dsh web --host` 绑在哪，这个页面只在回环地址上提供服务 —— 它既读取部署配置，又写入凭据。想
换路径就改这一行的 `path`，想整个去掉就禁用它：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dify-config
  disabled: true
```

### 环境变量

常见场景只需设置环境变量，既不用改 YAML 也不用开页面：

```sh
export DIFY_API_KEY=app-xxx
export DIFY_BASE_URL=https://your-dify-host/v1     # 可选，默认 https://api.dify.ai/v1
export DIFY_DATASET_ID=dataset_id_1                 # 除非写进 YAML，否则 dify_retrieve 必填
export DIFY_USER=end-user-id                        # 可选，默认 dsh-user
```

挂载了 DSH 凭据服务时，API Key 从 `~/.dsh/.credentials.yaml` 解析；否则回落到启动环境。切勿把密钥
写进配置文件。

### `@deepseek-ai/dsh-dify`（接缝）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `provider` | 自动 | 指定提供方 id；不填时若仅有一个可用提供方则自动选中。等价于 `$DSH_DIFY_PROVIDER`。 |

### `@deepseek-ai/dsh-dify/http`（提供方）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `apiKey` | — | 字面量密钥，优先使用 `apiKeyEnv`。 |
| `apiKeyEnv` | `DIFY_API_KEY` | 每次操作时解析的凭据引用名。 |
| `baseURL` | `$DIFY_BASE_URL` → `https://api.dify.ai/v1` | 端点基址，其后追加 `/chat-messages` 等路径。 |
| `user` | `$DIFY_USER` → `dsh-user` | 每个请求携带的 Dify 终端用户标识。 |
| `datasetId` | `$DIFY_DATASET_ID` | `dify_retrieve` 默认使用的数据集。 |

### `@deepseek-ai/dsh-dify/tool`（消费方）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `timeoutMs` | `60000` | 单次调用的超时预算。注册时读取，改动需重启。 |

### `@deepseek-ai/dsh-dify/config`（配置页）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `path` | `/dify` | 页面及其 JSON 端点（`/state`、`/save`、`/probe`）的挂载路径。 |

## 调用流程

### dify_chat

1. 模型调用 `dify_chat`，传入 `query` 和可选的 `conversationId`。
2. 工具校验后调用 `ctx.dify.chat({ query, conversationId }, signal)`。
3. 接缝选择可用的提供方并转发请求。
4. 提供方以 blocking 模式请求 `POST /chat-messages`。
5. 工具渲染回答文本。

### dify_retrieve

1. 模型调用 `dify_retrieve`，传入 `query` 和可选的 `datasetId`。
2. 工具校验后调用 `ctx.dify.retrieve({ query, datasetId }, signal)`。
3. 接缝选择可用的提供方并转发请求。
4. 提供方请求 `POST /datasets/{id}/retrieve` 并归一化 `records[]`。
5. 工具将文本块渲染为带引用的文本和结构化元数据。

空结果也是结果：工具会告诉模型知识库中没有相关内容，而不是凭空编造引用。

## 开发

```sh
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm build       # tsdown → lib/{index,http,tool,config}.js
```

`lib/` 已随仓库提交；每次修改 `src/` 后需重新构建并提交。

## Dify API 参考

- [智能体 API](https://docs.dify.ai/zh/api-reference/guides/agent)
- [对话消息](https://docs.dify.ai/zh/api-reference/llm-app/chat-messages)
- [知识库检索](https://docs.dify.ai/zh/api-reference/knowledge-base/retrieve)

## 故障排查

| 症状 | 原因 | 修复 |
|---|---|---|
| `DIFY_SCOPE_MISSING` | 未配置数据集 id | 设置 `datasetId` 或 `$DIFY_DATASET_ID` |
| `DIFY_PROVIDER_CREDENTIAL_MISSING` | 凭据引用无对应密钥 | 设置 `$DIFY_API_KEY`，或将 `apiKeyEnv` 匹配你的凭据键名 |
| `DIFY_PROVIDER_UNAUTHORIZED` | Dify 拒绝了密钥 | 在 Dify 中重新签发密钥 |
| `DIFY_PROVIDER_UNAVAILABLE` | 提供方行缺失或选项无效 | 检查 `--dump-config` 中的 `dify-http` 行 |
| `DIFY_PROVIDER_AMBIGUOUS` | 注册了多个可用提供方 | 用接缝的 `provider` 指定一个 |
| `dify_chat` / `dify_retrieve` 不在工具列表中 | bundle 未加载 | `dsh --dump-config \| grep dify`；重启 `dsh web` |
| 页面返回 `NOT_LOOPBACK` | 从局域网地址访问 | 从本机打开，或做端口隧道 |
| 页面返回 `SETTINGS_CONFLICT` | 设置文档自页面加载后已变更 | 刷新页面重新应用 |

## 已知限制

- 仅支持 blocking 模式 —— 不支持 SSE 流式返回，需等待完整响应。
- `dify_chat` 不转发文件输入或视觉附件。
- `dify_retrieve` 不支持多数据集搜索或 `attachment_ids`。
- 配置页不列出可选的 Dify 应用或数据集供选择。
