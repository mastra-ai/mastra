---
'@mastra/server': patch
---

Trace queries that filter by `requestId`, `serviceName`, or `experimentId` now return `501` with a clear message when the configured observability store is too old to support them, instead of failing with a `500`. The capabilities route reports support as `traceQueryContextFields`.
