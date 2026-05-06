---
'@mastra/core': minor
---

Eval scores are now emitted exactly once through the unified observability pipeline (`mastra.observability.addScore()`), so exporters no longer receive duplicate score deliveries. Internally, `MastraScorer.run()` is the single source of score events.

This release also includes two related fixes:

- **`scorerName` is persisted to its own column on observability score records.** The score record schema already exposes a top-level `scorerName` column; the record builder was previously stuffing `scorerName` inside `metadata` as a workaround. Queries and UIs can now read `scorerName` directly without scanning metadata.

- **Workflow step scorers now reach the observability bus.** `Mastra` already auto-registered agent-level scorers via `addScorer` (which calls `__registerMastra`); the same wiring was missing for workflow step scorers. Without it, `MastraScorer.run()` skipped the score-event publish for workflow scorers and exporters never received their scores via `onScoreEvent`. Workflow scorers now auto-register the same way agent scorers do.
