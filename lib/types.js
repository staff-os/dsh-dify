import { HarnessError } from "@deepseek-ai/dsh-llm";
//#region src/types.ts
/**
* Vocabulary for the Dify agent and knowledge-base capability seam
* (`ctx.dify`): the request and result shapes, the provider contract, and
* the error taxonomy. Providers and consumers depend only on this module, never
* on each other.
*
* Dify's Service API exposes two surfaces this seam models:
* - **Chat** (`POST /chat-messages`): a conversational agent app with a
*   `conversation_id`, streaming SSE, and tool/agent events.
* - **Knowledge retrieval** (`POST /datasets/{id}/retrieve`): a direct
*   retrieval from a Dify knowledge base (dataset).
*
* @module @deepseek-ai/dsh-dify/types
*/
/**
* Typed Dify error with a machine-routable, open-string `code` and chained
* `cause`. Shared codes cover unavailable, missing, unusable, ambiguous, or
* duplicate providers, cancellation, missing credentials, and provider
* failure. Tool execution exposes the code in structured error metadata.
*/
var DifyError = class extends HarnessError {};
//#endregion
export { DifyError as t };
