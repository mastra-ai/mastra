---
'@mastra/core': minor
---

Trace and span queries can now sort by `timeToFirstChunkMs`, in either direction. Missing values sort last, and pages stay stable when values tie. Stores that support it declare the `trace-query-time-to-first-chunk-sort` feature.

```typescript
const page = await storage.queryTraces(
  planTraceQuery(parseTraceQueryRequest({ timeRange, orderBy: [{ field: 'timeToFirstChunkMs', direction: 'desc' }] })),
);
```
