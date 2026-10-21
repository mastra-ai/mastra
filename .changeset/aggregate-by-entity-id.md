---
'@mastra/core': minor
'@mastra/duckdb': minor
'@mastra/clickhouse': minor
'@mastra/pg': minor
---

`aggregateTraces()` can now group by the root span's `entityId`, and trace queries and aggregates accept `entityId` as a trace-scope `where` field. Use it to split traces that have no `entityName` (for example, scorer runs recorded before scorers set one) by the primitive that produced them, then drill into a group by filtering on the same `entityId`.

```ts
const { rows } = await client.aggregateTraces({
  timeRange,
  where: { op: 'notExists', path: 'entityName' },
  groupBy: ['entityId'],
  measures: ['count'],
});
```

Trace-scope `entityId` reads the root span only. Inside `spans.some` and `spans.none`, `entityId` still matches any span in the trace. Stores that support the trace-scope field declare the new `trace-query-root-entity-id` storage feature.
