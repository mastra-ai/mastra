---
'@mastra/client-js': minor
---

Added methods to delete experiments. Deleting an experiment also deletes the observability traces it produced, cascading to their spans and trace-linked scores, feedback, metrics and logs. Pass `deleteTraces: false` to delete only the experiment and its results.

**Delete an experiment from a dataset**

```ts
await client.deleteDatasetExperiment(datasetId, experimentId);
```

**Delete any experiment, including orphaned experiments whose dataset was already deleted**

```ts
await client.deleteExperiment(experimentId);
```

**Keep the experiment's traces**

```ts
await client.deleteExperiment(experimentId, { deleteTraces: false });
```
