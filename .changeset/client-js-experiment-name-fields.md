---
'@mastra/client-js': patch
---

Added the `name` and `description` fields to the `DatasetExperiment` type. The server already returned these values, so you can now read an experiment's name and description directly from `listDatasetExperiments`, `listExperiments`, and `getDatasetExperiment` — no cast needed.

```ts
const { experiments } = await client.listDatasetExperiments(datasetId);

for (const experiment of experiments) {
  console.log(experiment.name, experiment.description);
}
```
