---
'@mastra/core': minor
---

Added `timeToFirstChunkMs` to trace and span queries. `queryTraces()` returns the root span's time to first chunk and `querySpans()` returns each span's, both `null` when no chunk was streamed. Both accept `timeToFirstChunkMs` filters with the same operators as `durationMs`. Stores that support it declare the `trace-query-time-to-first-chunk` feature.
