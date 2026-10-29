---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added support for filtering and grouping span and trace queries by `outcome` and `stopReason`, and returned `outcome`, `stopReason`, and `stopReasonContext` on span and trace results. Trace-level values come from the root span.

With one of these stores configured, query traces whose root span hit a limit:

```ts
const { traces } = await client.queryTraces({
  timeRange,
  where: { op: 'eq', left: { path: 'outcome' }, right: { literal: 'limit' } },
});
```
