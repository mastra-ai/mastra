---
'@mastra/core': patch
---

Fixed output-stream processing for durable tool results after a restart or cleanup, including Inngest resumes. Restored processors receive the request context, and processor reconstruction failures stop tool execution instead of exposing unprocessed output. Fixes #26148.
