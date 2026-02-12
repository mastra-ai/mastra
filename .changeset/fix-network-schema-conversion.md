---
'@mastra/client-js': patch
---

Fixed `ClientAgent.network()` to properly convert `structuredOutput.schema` and `requestContext` before sending to the server, matching the existing behavior of `generate()` and `stream()`. Previously, Zod schemas passed to `network()` lost non-enumerable properties during JSON serialization, causing the server to misidentify them as pre-converted JSON Schema and resulting in OpenAI rejecting the malformed schema.
