# Phase 6: Storage & DefaultExporter

**Status:** NOT STARTED — UP NEXT
**Prerequisites:** Phase 1 ✅, Phase 3 (partially) ✅
**Scope:** Storage interfaces, DefaultExporter signal handlers, storage adapters

---

## Overview

Phase 6 implements storage for all observability signals:
- DefaultExporter signal handlers (logs, metrics, scores, feedback — tracing already done)
- Storage operation schemas and interfaces
- Memory storage adapter (initial target for development/testing)
- DuckDB adapter for local development (deferred — after memory storage works)
- ClickHouse adapter for production (deferred — after memory storage works)

> **Updated approach (2026-03-04):** This phase will be developed **simultaneously** with Phase 7 (Server & Client APIs). Initial implementation will use **memory storage** to get the full pipeline working end-to-end. Storage adapter implementations (DuckDB, ClickHouse) will follow as a separate effort once the interfaces and APIs are stable.

---

## Package Change Strategy

| PR | Package | Scope | File | Priority |
|----|---------|-------|------|----------|
| PR 6.0 | `packages/core` | Storage operation schemas for all signals | [pr-6.0-storage-schemas.md](./pr-6.0-storage-schemas.md) | **Now** |
| PR 6.1 | `@mastra/observability` | DefaultExporter signal handlers | [pr-6.1-default-exporter.md](./pr-6.1-default-exporter.md) | **Now** |
| PR 6.M | `packages/core` or `stores/memory` | Memory storage adapter (all signals) | _New — not yet spec'd_ | **Now** |
| PR 6.2 | `stores/duckdb` | Spans, logs, metrics, scores, feedback tables | pr-6.2-duckdb-*.md | Deferred |
| PR 6.3 | `stores/clickhouse` | Spans, logs, metrics, scores, feedback tables | pr-6.3-clickhouse-*.md | Deferred |

---

## Dependencies Between PRs

```
PR 6.0 (Storage Schemas) ← defines types for storage operations
    ↓
PR 6.1 (DefaultExporter) ← adds onLogEvent, onMetricEvent, onScoreEvent, onFeedbackEvent
PR 6.M (Memory Storage)  ← implements storage interface in memory (can parallel with 6.1)
    ↓
Phase 7 (Server & Client APIs) ← simultaneous development
    ↓
PR 6.2 (DuckDB) ← deferred until interfaces are stable
PR 6.3 (ClickHouse) ← deferred until interfaces are stable (can parallel with 6.2)
```

> **Note:** The DefaultExporter already handles tracing events with production-ready batching, buffering, and retry logic. The work here is adding handlers for the remaining 4 signals (logs, metrics, scores, feedback).

> **Note (2026-03-04):** RecordedSpanImpl, RecordedTraceImpl, and the post-hoc scoring flow (from PR 3.4) are now part of this phase. Scoring is post-hoc only — the eval system and API create scores by pulling traces from storage. The legacy hook system (`createOnScorerHook` / `addScoreToTrace()`) will be removed.

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

**Immediate (memory storage):**
- [ ] Storage operation schemas (Zod) for logs, metrics, scores, feedback
- [ ] DefaultExporter handles all 5 signal types (T/M/L/S/F)
- [ ] Memory storage adapter implements all signal storage operations
- [ ] RecordedSpanImpl and RecordedTraceImpl classes (from PR 3.4, needs storage)
- [ ] RecordedSpan.addScore() / addFeedback() — post-hoc scoring via bus (from PR 3.4)
- [ ] Remove legacy hook system (`createOnScorerHook` / per-exporter `addScoreToTrace()`)
- [ ] End-to-end pipeline working: signal emission → bus → DefaultExporter → memory storage
- [ ] End-to-end scoring: pull RecordedTrace from storage → addScore() → ScoreEvent → bus → storage
- [ ] All tests pass

**Deferred (storage adapters):**
- [ ] DuckDB adapter supports all signals with appropriate schemas
- [ ] ClickHouse adapter supports all signals with appropriate schemas
- [ ] Batch write optimizations implemented
- [ ] Storage strategy getters return appropriate values
