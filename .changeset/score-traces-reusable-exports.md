---
'@mastra/core': minor
---

Made the trace-scoring primitives reusable outside the internal batch-scoring workflow. `@mastra/core/evals/scoreTraces` now exports `buildScorerRun` (maps a trace + target span to a scorer's input/output), `scoreTarget`/`scoreTargets` (run a scorer against resolved trace targets and return the results without persisting), `runScorerOnTarget`, and the `ScoreTargetResult` type. Span tenancy is now threaded through scoring: a span's `organizationId` and `resourceId` (project scope) are forwarded into the scorer run's `targetCorrelationContext` and `targetMetadata`, and into the legacy scores-store save payload (`organizationId` + `projectId`), so trace-scored results are correctly multi-tenant.
