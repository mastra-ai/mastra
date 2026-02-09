# Phase 6: Stores & DefaultExporter

**Status:** Planning
**Prerequisites:** Phase 1-5 (all signal implementations complete)
**Estimated Scope:** Storage adapters for all signals, DefaultExporter

---

## Overview

Phase 6 implements storage for all observability signals:
- DefaultExporter that converts Exported → Record types and writes to storage
- DuckDB adapter for local development (all signals)
- ClickHouse adapter for production (all signals)
- Storage strategy implementations

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 6.0 | `packages/core` | Storage operation schemas for all signals | [pr-6.0-storage-schemas.md](./pr-6.0-storage-schemas.md) |
| PR 6.1 | `@mastra/observability` | DefaultExporter implementation | [pr-6.1-default-exporter.md](./pr-6.1-default-exporter.md) |
| PR 6.2 | `stores/duckdb` | Spans, logs, metrics, scores, feedback tables | pr-6.2-duckdb-*.md |
| PR 6.3 | `stores/clickhouse` | Spans, logs, metrics, scores, feedback tables | pr-6.3-clickhouse-*.md |

---

## Dependencies Between PRs

```
PR 6.0 (Storage Schemas) ← defines types for storage operations
    ↓
PR 6.1 (DefaultExporter) ← uses schemas for Exported → Record conversion
    ↓
PR 6.2 (DuckDB) ← implements storage interface
PR 6.3 (ClickHouse) ← implements storage interface (can run in parallel with 6.2)
```

---

## Detailed Storage Documents

These documents contain the detailed storage implementations:

### DuckDB (PR 6.2)
- [pr-6.2-duckdb-spans.md](./pr-6.2-duckdb-spans.md) - Spans table
- [pr-6.2-duckdb-logs.md](./pr-6.2-duckdb-logs.md) - Logs table
- [pr-6.2-duckdb-metrics.md](./pr-6.2-duckdb-metrics.md) - Metrics table
- [pr-6.2-duckdb-scores-feedback.md](./pr-6.2-duckdb-scores-feedback.md) - Scores/Feedback tables

### ClickHouse (PR 6.3)
- [pr-6.3-clickhouse-logs.md](./pr-6.3-clickhouse-logs.md) - Logs table
- [pr-6.3-clickhouse-metrics.md](./pr-6.3-clickhouse-metrics.md) - Metrics table
- [pr-6.3-clickhouse-scores-feedback.md](./pr-6.3-clickhouse-scores-feedback.md) - Scores/Feedback tables

---

## DefaultExporter

The DefaultExporter is responsible for:
1. Receiving Exported types from the ObservabilityBus
2. Converting Exported → Record types
3. Writing Records to configured storage

```typescript
export class DefaultExporter implements ObservabilityExporter {
  constructor(private storage: ObservabilityStorage) {}

  onTracingEvent(event: TracingEvent): void {
    const record = convertToSpanRecord(event.span);
    this.storage.batchCreateSpans({ spans: [record] });
  }

  onLogEvent(event: LogEvent): void {
    const record = convertToLogRecord(event.log);
    this.storage.batchCreateLogs({ logs: [record] });
  }

  onMetricEvent(event: MetricEvent): void {
    const record = convertToMetricRecord(event.metric);
    this.storage.batchRecordMetrics({ metrics: [record] });
  }

  onScoreEvent(event: ScoreEvent): void {
    const record = convertToScoreRecord(event.score);
    this.storage.createScore({ score: record });
  }

  onFeedbackEvent(event: FeedbackEvent): void {
    const record = convertToFeedbackRecord(event.feedback);
    this.storage.createFeedback({ feedback: record });
  }
}
```

---

## Definition of Done

- [ ] DefaultExporter converts and writes all signal types
- [ ] DuckDB adapter supports all signals with appropriate schemas
- [ ] ClickHouse adapter supports all signals with appropriate schemas
- [ ] Batch write optimizations implemented
- [ ] Storage strategy getters return appropriate values
- [ ] All tests pass
