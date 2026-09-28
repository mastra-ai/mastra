---
'@mastra/inngest': patch
---

Fixed Inngest durable agents reporting `[object Object]` when a run fails. The stream error, `generate()` rejection, HTTP 500 response, and workflow tracing span now carry the real failure message, such as Inngest's `step output size is greater than the limit` error. Fixes [#25161](https://github.com/mastra-ai/mastra/issues/25161).
