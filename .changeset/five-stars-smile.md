---
'@mastra/core': minor
---

Aligned the built-in scorer hook (`createOnScorerHook`) with the unified `ScoreEvent` pipeline. The hook no longer iterates over exporters; `MastraScorer.run()` is now the sole producer of score events through `mastra.observability.addScore()`, which fans out via the observability bus.

**Why:** the legacy hook also published scores by calling each exporter's `addScoreToTrace` directly. Combined with `MastraScorer.run()` (which already publishes a `ScoreEvent`), every score was being delivered to exporters twice. Removing the duplicate path makes `MastraScorer.run()` the single source of truth.
