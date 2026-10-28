---
'@mastra/core': minor
---

Trace, span and thread queries can now return and filter by `timeToFirstTokenMs`, the time from the start of the model call to its first streamed chunk. Trace and span queries can also sort by it. Trace rows use the root span's value, and thread rows use the first trace's root agent. Missing values sort last. Stores that support it declare the `trace-query-time-to-first-token` and `trace-query-time-to-first-token-sort` features.

```typescript
const page = await storage.queryTraces(
  planTraceQuery(parseTraceQueryRequest({ timeRange, orderBy: [{ field: 'timeToFirstTokenMs', direction: 'desc' }] })),
);
```

Durable agents now carry the start of the model call that streamed the run's first chunk across steps, so their generation and agent run spans report time to first token too.
