---
'@mastra/langsmith': patch
---

Fixed LangSmith exporter losing runs: `flush()` now sends queued batches when the client uses `manualFlushMode` (overlapping calls wait for the earlier upload), and `shutdown()` sends the updates for spans it aborts instead of leaving them pending.
