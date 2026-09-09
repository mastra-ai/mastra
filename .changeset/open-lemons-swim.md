---
'@mastra/client-js': patch
---

Added a `tags` option to `listDatasetExperimentResults()` so you can restrict results to those that carry every listed tag.

```ts
const { results } = await client.listDatasetExperimentResults('dataset-id', 'exp-id', {
  tags: ['regression', 'p0'],
});
```
