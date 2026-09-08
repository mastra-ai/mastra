---
'@mastra/client-js': minor
---

Added `updateDatasetExperiment()` to rename an experiment or change its description and metadata.

```typescript
const experiment = await client.updateDatasetExperiment({
  datasetId: 'dataset-id',
  experimentId: 'exp-id',
  name: 'Baseline vs. new prompt',
});
```
