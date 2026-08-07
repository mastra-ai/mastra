---
'@mastra/core': minor
---

Added typed experiment provenance and grouping fields that persist across synchronous and asynchronous runs and can be filtered when listing experiments.

```ts
await dataset.startExperiment({
  task,
  scorers,
  provenance: { source: 'github', sourceVersion: 'abc123' },
  grouping: { experimentSetId: 'benchmark-1', variantId: 'candidate', trialIndex: 0 },
});
```
