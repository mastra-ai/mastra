---
'@mastra/client-js': minor
---

Added methods to delete experiments.

**Delete an experiment from a dataset**

```ts
await client.deleteDatasetExperiment(datasetId, experimentId);
```

**Delete any experiment, including orphaned experiments whose dataset was already deleted**

```ts
await client.deleteExperiment(experimentId);
```
