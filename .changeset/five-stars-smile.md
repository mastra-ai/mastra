---
'@mastra/core': minor
---

Eval scores are now emitted exactly once through the unified observability pipeline (`mastra.observability.addScore()`), so exporters no longer receive duplicate score deliveries. Internally, `MastraScorer.run()` is the single source of score events.
