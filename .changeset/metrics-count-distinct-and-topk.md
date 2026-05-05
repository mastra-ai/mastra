---
'@mastra/core': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added `count_distinct` aggregation and server-side TopK to the metrics storage API so dashboards built on high-cardinality fields (like `threadId` or `resourceId`) stay fast and bounded.

**New aggregation**

`getMetricAggregate`, `getMetricBreakdown`, and `getMetricTimeSeries` accept `aggregation: 'count_distinct'` with a `distinctColumn`. Backends pick the most efficient native implementation — `uniq` on ClickHouse, `approx_count_distinct` on DuckDB.

`distinctColumn` is restricted to a low/medium-cardinality categorical allowlist (`entityType`, `entityName`, `parentEntityType`, `parentEntityName`, `rootEntityType`, `rootEntityName`, `name`, `provider`, `model`, `environment`, `executionSource`, `serviceName`). ID columns are not allowed — distinct counts over near-unique values converge to the row count and are rarely useful.

```ts
await store.getMetricAggregate({
  name: ['mastra_llm_tokens_total'],
  aggregation: 'count_distinct',
  distinctColumn: 'model',
  filters: { timestamp: { start, end } },
});
```

**Server-side TopK**

`getMetricBreakdown` accepts `limit` and `orderDirection`, so breakdowns never return the full cardinality of a column from the database. Ordering is always by the aggregated `value`; `orderDirection` flips between top-N (`DESC`, default) and bottom-N (`ASC`).

```ts
await store.getMetricBreakdown({
  name: ['mastra_agent_duration_ms'],
  aggregation: 'sum',
  groupBy: ['threadId'],
  limit: 20,
  orderDirection: 'DESC',
});
```
