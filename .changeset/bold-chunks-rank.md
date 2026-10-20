---
'@mastra/server': minor
---

Trace and span queries can now sort by `timeToFirstChunkMs`. The new `traceQueryTimeToFirstChunkSort` capability tells you whether the configured observability store supports it. When it doesn't, the sort returns `501` with a clear message before the store runs.
