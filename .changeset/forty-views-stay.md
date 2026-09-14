---
'@mastra/client-js': minor
---

Added typed `queryTraceThreads()` methods for querying thread identities across eligible traces.

```ts
const result = await mastraClient.queryTraceThreads({
  traces: {
    timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
  },
});
```

`queryTraces()` remains trace-only, while `queryTraceThreads()` returns observability-derived thread identities.
