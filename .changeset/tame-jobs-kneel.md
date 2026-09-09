---
'@mastra/client-js': minor
---

Added methods to delete experiments. Deletion attempts to remove the observability traces produced by the experiment, including their spans and trace-linked signals. Unsupported observability storage leaves the traces in place and logs a warning.

**Delete an experiment from a dataset**

```ts
await client.deleteDatasetExperiment(datasetId, experimentId, {
  organizationId,
  projectId,
});
```

**Delete any experiment, including orphaned experiments whose dataset was already deleted**

```ts
await client.deleteExperiment(experimentId);
```
