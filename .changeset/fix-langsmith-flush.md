---
'@mastra/langsmith': patch
---

Add `_flush()` override to drain the LangSmith SDK's internal batch queue via `client.awaitPendingTraceBatches()`. Previously, flushing the exporter was a no-op, so queued trace data could be lost in serverless and durable execution environments.
