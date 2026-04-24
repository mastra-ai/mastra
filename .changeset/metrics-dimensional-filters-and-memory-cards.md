---
'@mastra/core': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/playground-ui': minor
'mastra': minor
---

Add dimensional filtering and memory-activity insights to the Studio metrics dashboard.

- **New aggregation**: `count_distinct` is now supported on `getMetricAggregate`, `getMetricBreakdown`, and `getMetricTimeSeries`, with an optional `distinctColumn` argument. Backends map it to the most efficient native implementation (`uniq` on ClickHouse, `approx_count_distinct` on DuckDB, a `Set` on InMemory).
- **Server-side TopK**: `getMetricBreakdown` now accepts `limit`, `orderBy` (`value` | `dimension`), and `orderDirection` so high-cardinality breakdowns (for example, per `threadId`) never return the full set from the database.
- **ClickHouse skip indexes**: `metric_events` gains `bloom_filter` skip indexes on `threadId`, `resourceId`, `userId`, and `organizationId`. New deployments get them automatically on `init`; existing deployments pick them up via the additive `ALTER TABLE ... ADD INDEX IF NOT EXISTS` migration and materialize lazily on merges.
- **Studio dashboard**: the metrics page now has a property-filter toolbar (dimensional filters persisted in the URL and `localStorage`), plus two new memory cards — **Active Threads** (distinct thread count) and **Top Active Threads** (per-thread run count, TopK).
