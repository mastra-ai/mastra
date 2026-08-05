---
'@mastra/ai-sdk': patch
---

Fixed the AI SDK stream announcing a response message id that matches no stored message when a processor rotates the response message id before the model runs (for example observational memory sealing a buffer chunk). The stream's `start` chunk now announces the id the assistant response is actually persisted under, so `useChat` and other AI SDK consumers can reconcile streamed messages with memory. Fixes [#19810](https://github.com/mastra-ai/mastra/issues/19810)
