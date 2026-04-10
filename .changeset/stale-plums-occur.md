---
'@mastra/core': minor
'@mastra/observability': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added unique IDs to all observability signals (logs, metrics, scores, feedback). Each event now carries a framework-generated `logId`, `metricId`, `scoreId`, or `feedbackId` created at emission time, acting as a de-duplication key in downstream OLAP stores and letting external systems link a specific signal back to Mastra. Log IDs align with the OpenTelemetry `log.record.uid` semantic convention. User code that calls `logger.info()`, `metrics.emit()`, `addScore()`, and `addFeedback()` does not change; the IDs are populated automatically. Closes #15223.
