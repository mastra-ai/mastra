---
'@mastra/inngest': patch
---

Fixed durable agent abort requests being ignored when the run executes on an Inngest worker. Calling abort() on a run in another process now stops generation and ends the stream with finishReason "abort". Fixes #22543.
