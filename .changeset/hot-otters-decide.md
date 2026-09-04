---
'@mastra/clickhouse': minor
---

Added ClickHouse trace filtering by richer same-span properties, including model, duration, outcome, identity, and lineage.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { spans: { some: { op: 'in', value: { path: 'provider' }, set: ['openai'] } } },
})
```
