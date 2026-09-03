---
'@mastra/core': minor
---

Added `dataset.updateExperiment()` to rename an experiment or change its description and metadata after it has been created. Status and result counters remain managed by the experiment lifecycle.

```typescript
const dataset = await mastra.datasets.get({ id: 'dataset-id' });

await dataset.updateExperiment({
  experimentId: 'exp-id',
  name: 'Baseline vs. new prompt',
  description: 'Run after switching to the shorter system prompt',
});
```
