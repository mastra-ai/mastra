---
'@mastra/clickhouse': minor
---

Added idempotent TTL updates for existing ClickHouse observability tables through `applyRetention()`. Deletion-request records now expire after the longest configured tracing, score, or feedback retention period plus 30 days.

```typescript
const observability = new ObservabilityStorageClickhouseVNext({
  client,
  retention: { tracing: 30, scores: 90 },
});

await observability.applyRetention();
```
