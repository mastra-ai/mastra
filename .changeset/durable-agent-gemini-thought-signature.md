---
'@mastra/core': patch
---

Fix: `DurableAgent` now preserves `providerMetadata` and `providerExecuted` on the tool-invocation parts it persists into the message list. Previously these fields were captured from the streaming `tool-call` chunk but dropped when building the V2 assistant message, so Gemini's `thoughtSignature` (delivered as `providerMetadata.google.thoughtSignature`) was lost across LLM steps. The next step then sent function calls without signatures and Vertex rejected the request with `AI_APICallError: Function call is missing a thought_signature in functionCall parts ... position N`.

Affects any agent wrapped via `createDurableAgent` / `new DurableAgent` against a Gemini thinking model (e.g. `gemini-3-flash-preview`, `gemini-3-pro-preview`). Non-durable `Agent` was unaffected because the AI-SDK kept state in-process.
