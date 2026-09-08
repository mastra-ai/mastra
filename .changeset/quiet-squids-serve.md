---
'@mastra/core': patch
'@mastra/server': patch
---

Added a `tags` filter to `dataset.listExperimentResults()` and `GET /api/datasets/:datasetId/experiments/:experimentId/results`. Only results that carry every listed tag are returned; results with extra tags still match.

```ts
const { results } = await dataset.listExperimentResults({
  experimentId: 'exp-id',
  tags: ['regression', 'p0'],
});
```

Over HTTP, pass repeated query params: `?tags=regression&tags=p0`.
