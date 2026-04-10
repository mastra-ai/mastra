---
'@mastra/core': minor
'@mastra/observability': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/server': patch
---

Added unique IDs (`logId`, `metricId`, `scoreId`, `feedbackId`) to all observability signals, generated automatically at emission time for de-duplication and cross-system linking. User-facing APIs (`logger.info()`, `metrics.emit()`, `addScore()`, `addFeedback()`) are unchanged.
