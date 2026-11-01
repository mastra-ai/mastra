---
'@mastra/client-js': minor
'@mastra/server': minor
---

Added an optional `status` filter (`needs-review`, `reviewed`, or `complete`) to `listDatasetExperimentResults` and the `GET /api/datasets/:datasetId/experiments/:experimentId/results` route, so you can list only the experiment results with a given review status:

```ts
await client.listDatasetExperimentResults(datasetId, experimentId, { status: 'needs-review' });
```
