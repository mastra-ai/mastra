---
'@mastra/core': minor
---

**Added observability storage domain schemas and implementations**

Introduced comprehensive storage schemas and in-memory implementations for all observability signals:

- **Scores**: `ScoreRecord`, `CreateScoreArgs`, `ListScoresArgs`, `ListScoresResponse` with filtering by `traceId`, `spanId`, `scorerId`, and `experimentId`
- **Logs**: `LogRecord`, `CreateLogArgs`, `ListLogsArgs`, `ListLogsResponse` with level and message filtering
- **Feedback**: `FeedbackRecord`, `CreateFeedbackArgs`, `ListFeedbackArgs`, `ListFeedbackResponse` with type and source filtering
- **Metrics**: `GetMetricAggregateArgs`, `GetMetricBreakdownArgs`, `GetMetricTimeSeriesArgs`, `GetMetricPercentilesArgs` for rich metric querying with period-over-period comparison
- **Discovery**: `getMetricNames()`, `getEntityTypes()`, `getEntityNames()`, `getEnvironments()`, `getServiceNames()` for dynamic filtering UIs
- **Record Builders**: `buildSpanRecord()`, `buildScoreRecord()`, `buildLogRecord()`, `buildFeedbackRecord()` for converting exported signals to storage records

All schemas are zod-based with full type inference. The `ObservabilityStorage` base class now includes default implementations for all new methods, ensuring backward compatibility for existing storage adapters.
