---
'@mastra/clickhouse': minor
---

Added ClickHouse support for filtering and ordering trace queries by `modelCost`, and for returning it in the table summary. Retried metric exports collapse by `metricId` before the cost rollup, unavailable costs stay `NULL`, and cost ordering pages deterministically with `traceId` as the tie-breaker.
