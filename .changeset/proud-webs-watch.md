---
'@mastra/inngest': patch
---

Fixed stopping an Inngest agent by thread or run id. Calling `abortThreadStream()` or `abortRunStream()` (including `POST /api/agents/:agentId/threads/abort` and the Studio stop button) now stops the run on the Inngest worker, and the stream ends with `finishReason: 'abort'`. Previously the call reported success while the run and its tools kept going. Fixes [#25156](https://github.com/mastra-ai/mastra/issues/25156).
