---
'@mastra/core': minor
'@mastra/observability': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/server': patch
---

Added unique IDs (`logId`, `metricId`, `scoreId`, `feedbackId`) to all observability signals, generated automatically at emission time. IDs enable de-duplication on the framework exporter retry path (where `DefaultExporter` requeues the same buffered event with its original timestamp, so ReplacingMergeTree collapses retries) and provide a stable cross-system correlation key. User-facing APIs (`logger.info()`, `metrics.emit()`, `addScore()`, `addFeedback()`) are unchanged.

Note: external HTTP writes to `POST /api/observability/scores` and `/feedback` are not currently idempotent even when the caller supplies their own ID, because the server re-stamps `timestamp` per request and reads do not dedupe by signal ID at query time. Closing that gap is tracked as follow-up work.

For existing ClickHouse and DuckDB observability signal tables, run `npx mastra migrate` before initializing the store so the new signal-ID schema is applied.
