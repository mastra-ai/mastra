---
'@mastra/server': patch
---

Trace, thread, and span queries can now filter on `timeToFirstChunkMs`. The new `traceQueryTimeToFirstChunk` capability tells you whether the configured observability store supports it. When it doesn't, a query that filters on `timeToFirstChunkMs` returns `501` with a clear message instead of failing with a `500`, and field discovery leaves the field out.
