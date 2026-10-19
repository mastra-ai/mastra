---
'@mastra/core': minor
'@mastra/duckdb': minor
'@mastra/clickhouse': minor
'@mastra/pg': minor
---

`aggregateTraces()` can now group by `entityId`. Use it to split traces that have no `entityName` (for example, scorer runs recorded before scorers set one) by the primitive that produced them.

```ts
const { rows } = await client.aggregateTraces({
  timeRange,
  where: { op: 'notExists', path: 'entityName' },
  groupBy: ['entityId'],
  measures: ['count'],
});
```
