---
'@mastra/client-js': minor
---

Added experiment provenance and grouping support to the JavaScript client.

```ts
await client.triggerDatasetExperiment({
  datasetId,
  targetType: 'agent',
  targetId: 'agent-1',
  grouping: { experimentSetId: 'benchmark-1', trialIndex: 0 },
});
```
