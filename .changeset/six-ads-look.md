---
'@mastra/duckdb': minor
---

Added DuckDB support for richer score predicates in advanced trace queries.

```ts
await mastraClient.queryTraces({
  timeRange: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-08T00:00:00.000Z' },
  where: { scores: { some: { op: 'eq', left: { path: 'scoreSource' }, right: { literal: 'automated' } } } },
})
```
