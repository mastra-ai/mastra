---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added a review status filter to the experiment results list. Pass `status` to get only the results with that review status.

```ts
const { results } = await client.listDatasetExperimentResults(datasetId, experimentId, {
  status: 'needs-review',
});
```
