---
'@mastra/spanner': minor
---

Added experiment provenance and grouping support to `@mastra/spanner`. When Spanner is configured as Mastra storage, these fields are preserved and available for grouping-based experiment queries.

```ts
await dataset.startExperiment({
  task,
  scorers,
  provenance: { source: 'github', sourceVersion: 'abc123' },
  grouping: { experimentSetId: 'benchmark-1', variantId: 'candidate', trialIndex: 0 },
});
```
