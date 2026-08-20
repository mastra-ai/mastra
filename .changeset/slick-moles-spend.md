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

Added caller-driven experiments so an external orchestrator (for example Temporal workers) can own the experiment loop while Mastra stays the system of record.

Create an experiment with `dataset.createExperiment()` (idempotent when you pass your own id). With a target, Mastra runs each item for you: call `dataset.runExperimentItem()` per item and Mastra executes the registered agent or workflow, resolves scorers (experiment `scorers`, falling back to item `scorerIds`, then dataset `scorerIds`), and upserts the result. Without a target, run everything yourself and report per-item results with `dataset.submitExperimentResult()` (upsert semantics on `(experimentId, itemId, attempt)` so retried workers converge on a single row). Either way, close the run with `dataset.finalizeExperiment()` and Mastra computes per-item succeeded/failed/skipped counts from the persisted rows. Results go into the same storage as native runs, so Studio views, comparisons, and review summaries work unchanged.

```typescript
// Caller drives the loop, Mastra runs each item
const { experimentId } = await dataset.createExperiment({
  id: workflowRunId,
  targetType: 'agent',
  targetId: 'support-agent',
  scorers: ['accuracy'],
});

await dataset.runExperimentItem({ experimentId, itemId });

// Or: caller runs everything, Mastra ingests results
const ingest = await dataset.createExperiment({ id: workflowRunId });
await dataset.submitExperimentResult({
  experimentId: ingest.experimentId,
  itemId,
  output,
  scores: [{ scorerId: 'accuracy', score: 0.92 }],
});

const experiment = await dataset.finalizeExperiment({ experimentId });
```
