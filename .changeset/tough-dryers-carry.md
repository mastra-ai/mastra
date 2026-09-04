---
'@mastra/clickhouse': minor
---

Added ClickHouse support for richer score predicates in advanced trace queries.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { scores: { some: { op: 'gte', left: { path: 'timestamp' }, right: { literal: '2026-08-01T00:00:00.000Z' } } } },
})
```
