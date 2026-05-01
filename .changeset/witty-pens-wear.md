---
'@mastra/core': minor
---

Fixed trajectory scorers in dataset.startExperiment receiving raw agent messages instead of a Trajectory object, which caused a crash when accessing run.output.steps. Trajectory scorers now receive the same pre-extracted Trajectory that runEvals provides.

The scorers option now also accepts the same categorised shape as runEvals (AgentScorerConfig / WorkflowScorerConfig), so you no longer need to rewrite your scorer config when moving from runEvals to dataset.startExperiment.

**Before (trajectory scorer crashed at runtime):**

await dataset.startExperiment({ scorers: [orderScorer] }) // run.output.steps was undefined

**After (works correctly, both flat and categorised forms accepted):**

await dataset.startExperiment({ scorers: [orderScorer] })
await dataset.startExperiment({ scorers: { agent: [accuracyScorer], trajectory: [orderScorer] } })

Per-step scorers are now also supported for workflow targets, matching `runEvals`. Pass `scorers: { workflow: [...], steps: { stepId: [...] }, trajectory: [...] }` to score individual workflow steps with their own scorers; results carry the originating `stepId` and keep `targetScope: 'span'` (with `targetEntityType: WORKFLOW_STEP` on the underlying scorer run), matching how `runEvals` encodes step identity.
