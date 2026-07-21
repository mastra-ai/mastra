---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added comment support to the experiment result API. The PATCH experiment result endpoint and the client updateDatasetExperimentResult method now accept and return a comment field, so review comments persist server-side instead of being lost on reload (https://github.com/mastra-ai/mastra/issues/19857).

```ts
const result = await client.updateDatasetExperimentResult({
  datasetId,
  experimentId,
  resultId,
  comment: 'Agent hallucinated an API that does not exist',
});
```
