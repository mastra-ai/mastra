---
'@mastra/clickhouse': minor
---

Added OLAP analytics methods for scores and feedback signals in the ClickHouse v-next observability adapter.

**Score analytics** — `getScoreAggregate`, `getScoreBreakdown`, `getScoreTimeSeries`, and `getScorePercentiles` provide aggregation, dimensional breakdown, time-bucketed series, and percentile distribution queries over score data keyed by `scorerId`.

**Feedback analytics** — `getFeedbackAggregate`, `getFeedbackBreakdown`, `getFeedbackTimeSeries`, and `getFeedbackPercentiles` provide the same analytics capabilities for feedback signals keyed by `feedbackType`, aggregating on numeric `valueNumber` values.

**Broadened schemas** — Score and feedback tables now include full entity hierarchy (`entityType`, `parentEntityType`, `rootEntityType`), correlation IDs (`runId`, `sessionId`, `threadId`, `requestId`), and deployment context (`environment`, `executionSource`, `serviceName`) to match the updated core record types.
