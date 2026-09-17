---
'@mastra/clickhouse': minor
---

Added idempotent TTL updates for existing ClickHouse observability tables through `applyRetention()`. When every observability signal has a retention period, deletion-request records expire after the longest signal retention plus 30 days. If any signal is unbounded, deletion-request records remain unbounded so they continue to prevent deleted data from being reintroduced.

```typescript
const observability = new ObservabilityStorageClickhouseVNext({
  client,
  retention: {
    tracing: 30,
    logs: 30,
    metrics: 30,
    scores: 90,
    feedback: 90,
  },
});

await observability.applyRetention();
```
