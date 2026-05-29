---
'@mastra/ai-sdk': patch
---

Fixed client-side tool tracing for useChat by carrying observability context through AI SDK v6 `toolMetadata` on `tool-input-available` stream chunks.
