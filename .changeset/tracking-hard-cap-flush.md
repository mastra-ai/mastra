---
'@mastra/observability': patch
---

Tracking exporters now wait for in-progress trace-cap evictions in `flush()` and `shutdown()`, so the aborted spans are sent instead of being queued after the flush or aborted twice.
