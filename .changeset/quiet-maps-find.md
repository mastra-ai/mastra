---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added a `datasetIds` filter to dataset listing, so you can fetch specific datasets by ID in one request. All matches come back on one page, up to 100 IDs.

```ts
const { datasets } = await client.listDatasets({ datasetIds: ['dataset-1', 'dataset-2'] });
```
