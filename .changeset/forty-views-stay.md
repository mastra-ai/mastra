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

New `queryTraces()` calls return trace results statically. Legacy grouped calls remain available through a deprecated grouped-result overload.
