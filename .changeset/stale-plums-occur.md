---
'@mastra/core': minor
'@mastra/observability': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/server': patch
---

Added unique IDs (`logId`, `metricId`, `scoreId`, `feedbackId`) to all observability signals, generated automatically at emission time for de-duplication across the framework pipeline and cross-system correlation. User-facing APIs (`logger.info()`, `metrics.emit()`, `addScore()`, `addFeedback()`) are unchanged.

For existing ClickHouse and DuckDB observability signal tables, run `npx mastra migrate` before initializing the store so the new signal-ID schema is applied.
