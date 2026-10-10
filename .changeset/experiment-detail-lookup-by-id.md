---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'mastra': patch
---

Fixed the Studio experiment page showing "Experiment not found" for experiments older than the 10 most recent. The page and its breadcrumb now load the experiment by ID instead of searching the first page of the experiments list.

Added `GET /api/experiments/:experimentId`, `client.getExperiment()` and the `useExperiment()` hook to get an experiment by ID without knowing its dataset.

```ts
const experiment = await client.getExperiment('experiment-id');
console.log(experiment.datasetId);
```
