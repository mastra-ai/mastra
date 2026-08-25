---
'@mastra/core': patch
---

Fix Workspace tool output-validation errors reaching the model as untagged objects. `sandboxToModelOutput` now converts Mastra validation-error envelopes to AI SDK `{ type: 'error-json', value }` tool results, so OpenAI-compatible providers serialize a tool message with valid `content` instead of rejecting the request.
