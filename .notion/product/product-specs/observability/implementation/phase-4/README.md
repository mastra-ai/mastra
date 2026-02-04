# Phase 4: Scores & Feedback

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Logging), Phase 3 (Metrics)
**Estimated Scope:** Score/Feedback APIs, storage, exporter support

---

## Overview

Phase 4 implements the scores and feedback system:
- `span.addScore()` / `span.addFeedback()` APIs
- `trace.addScore()` / `trace.addFeedback()` APIs
- `mastra.getTrace(traceId)` for post-hoc attachment
- Score/Feedback schemas and storage methods
- ScoreEvent and FeedbackEvent emission to exporters
- Exporter support via `onScoreEvent()` / `onFeedbackEvent()`

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 4.1 | `@mastra/core` | Score/Feedback schemas, storage interface, APIs | [pr-4.1-core-changes.md](./pr-4.1-core-changes.md) |
| PR 4.2 | `@mastra/observability` | Span/Trace implementations, ScoreEvent/FeedbackEvent emission | [pr-4.2-observability-changes.md](./pr-4.2-observability-changes.md) |
| PR 4.3 | `stores/duckdb` | Scores/Feedback tables and methods | [pr-4.3-duckdb-scores.md](./pr-4.3-duckdb-scores.md) |
| PR 4.4 | `stores/clickhouse` | Scores/Feedback tables and methods | [pr-4.4-clickhouse-scores.md](./pr-4.4-clickhouse-scores.md) |

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Add score to active span
- [ ] E2E test: Add feedback to active span
- [ ] E2E test: Add score to trace (no span)
- [ ] E2E test: Retrieve trace and add post-hoc score
- [ ] E2E test: Retrieve trace and add post-hoc feedback
- [ ] E2E test: List scores by trace ID
- [ ] E2E test: List feedback by experiment
- [ ] E2E test: Verify metrics extracted from score events

---

## Dependencies Between PRs

```
PR 4.1 (@mastra/core)
    ↓
PR 4.2 (@mastra/observability) ← depends on core types
    ↓
PR 4.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 4.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 4.3 and PR 4.4 can be done in parallel after PR 4.2.

**Merge order:** 4.1 → 4.2 → (4.3 | 4.4)

---

## Definition of Done

- [ ] span.addScore() and span.addFeedback() working
- [ ] trace.addScore() and trace.addFeedback() working
- [ ] mastra.getTrace() returns Trace with spans
- [ ] Post-hoc score/feedback attachment working
- [ ] DefaultExporter writes scores and feedback
- [ ] DuckDB adapter stores and retrieves scores/feedback
- [ ] ClickHouse adapter stores and retrieves scores/feedback
- [ ] All tests pass
- [ ] Documentation updated

---

## Open Questions

1. Should we support batch score/feedback creation?
2. Should scores be linked to the existing evals scores table?
3. What's the migration path from existing `addScoreToTrace` API?
4. Should we add experiment/run grouping for score aggregation?
