---
'@mastra/core': patch
---

Added public Zod request and response schemas and types for the upcoming `aggregateTraces()` observability operation: `traceAggregateRequestSchema`, `traceAggregateResponseSchema`, and `parseTraceAggregateRequest()`. Selection (`timeRange`, `where`) reuses the existing trace-query schemas, so aggregate and list queries validate the same population. No runtime operation ships yet; the storage method and HTTP route follow in later releases.
