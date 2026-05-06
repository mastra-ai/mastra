---
'@mastra/core': patch
---

Fixed workflow step scorers being silently skipped on the observability score event path. `Mastra` already auto-registered agent-level scorers via `addScorer` (which calls `__registerMastra`), but workflow step scorers were not registered the same way. As a result, `MastraScorer.run()` did not see a Mastra instance, and the score event was never published to the bus, so registered exporters never received scores from workflow step scorers via `onScoreEvent`. Workflow scorers now auto-register the same way agent scorers do.
