---
'@mastra/core': patch
---

Fix: `DurableAgent` now preserves `providerMetadata` and `providerExecuted` on the tool-invocation parts it persists into the message list.

Previously, `DurableAgent` captured `providerMetadata` and `providerExecuted` from the streaming `tool-call` chunk but dropped them when building the V2 assistant message, which caused `providerMetadata.google.thoughtSignature` to be lost across LLM steps. The following step then sent function calls without thought signatures, and Vertex rejected the request with `AI_APICallError: Function call is missing a thought_signature in functionCall parts ... position N`.

Vertex/Gemini also emits `thoughtSignature` on a sibling chunk (e.g. `reasoning` / `finish-step`) that precedes the `tool-call` chunk for the same call, so the `tool-call` chunk itself often has no `providerMetadata`. The executor now also carries the most recent chunk-level `providerMetadata` forward as a fallback so the persisted part still has the signature.

Affects any agent wrapped via `createDurableAgent` / `new DurableAgent` against a Gemini thinking model (e.g. `gemini-3-flash-preview`, `gemini-3-pro-preview`). Non-durable `Agent` was unaffected because the AI-SDK kept state in-process.
