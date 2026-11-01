---
'@mastra/react': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Fixed the Studio Review Queue and completed view only showing results from the first 10 results of each experiment. Review items are now loaded across every page of experiment results.

`listDatasetExperimentResults` and the experiment results route now accept an optional `status` filter (`needs-review`, `reviewed`, or `complete`):

```ts
await client.listDatasetExperimentResults(datasetId, experimentId, { status: 'needs-review' });
```
