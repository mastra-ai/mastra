---
'@mastra/core': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added `count_distinct` aggregation and server-side TopK to the metrics storage API so dashboards built on high-cardinality fields (like `threadId` or `resourceId`) stay fast and bounded.

**New aggregation**

`getMetricAggregate`, `getMetricBreakdown`, and `getMetricTimeSeries` accept `aggregation: 'count_distinct'` with an optional `distinctColumn`. Backends pick the most efficient native implementation — `uniq` on ClickHouse, `approx_count_distinct` on DuckDB.

```ts
await store.getMetricAggregate({
  name: 'mastra_agent_duration_ms',
  aggregation: 'count_distinct',
  distinctColumn: 'threadId',
  filters: { timestamp: { start, end } },
});
```

**Server-side TopK**

`getMetricBreakdown` accepts `limit`, `orderBy` (`value` | `dimension`), and `orderDirection`, so breakdowns never return the full cardinality of a column from the database.

```ts
await store.getMetricBreakdown({
  name: 'mastra_agent_duration_ms',
  aggregation: 'sum',
  groupBy: 'threadId',
  limit: 20,
  orderBy: 'value',
  orderDirection: 'desc',
});
```

**ClickHouse skip indexes**

`metric_events` gains `bloom_filter` skip indexes on `threadId`, `resourceId`, `userId`, and `organizationId`. New deployments pick them up automatically on `init`; existing deployments get them via an additive `ALTER TABLE … ADD INDEX IF NOT EXISTS` migration and materialize lazily on merges. No manual `MATERIALIZE INDEX` is required.
