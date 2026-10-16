---
'@mastra/core': minor
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/pg': patch
---

Added the root span's `name` and `spanType` to trace queries and trace aggregates. `aggregateTraces()` can group by them (including `countDistinct.name` and `countDistinct.spanType`), `queryTraces()` and `aggregateTraces()` can filter on them, and trace query discovery lists them with value suggestions. Inside `spans.some` predicates, `name` and `spanType` still match any span.

```ts
await mastraClient.aggregateTraces({
  timeRange,
  where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'workflow_run' } },
  groupBy: ['name'],
  measures: ['count', 'errorRate'],
});
```
