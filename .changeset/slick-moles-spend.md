---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added external experiments so you can run evaluations on your own infrastructure (for example Temporal workers) while Mastra stays the system of record.

Create an experiment with `dataset.createExternalExperiment()` (idempotent when you pass your own id), report per-item results with `dataset.submitExperimentResult()` (upsert semantics on `(experimentId, itemId, attempt)` so retried workers converge on a single row instead of duplicating results), and close the run with `dataset.finalizeExperiment()` (Mastra computes succeeded/failed/skipped counts from the persisted rows). Results land in the same storage as native runs, so Studio views, comparisons, and review summaries work unchanged.

```typescript
const { experimentId } = await dataset.createExternalExperiment({ id: workflowRunId });

await dataset.submitExperimentResult({
  experimentId,
  itemId,
  output,
  scores: [{ scorerId: 'accuracy', score: 0.92 }],
});

const experiment = await dataset.finalizeExperiment({ experimentId });
```
