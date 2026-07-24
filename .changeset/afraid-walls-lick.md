---
'@mastra/core': patch
---

Fixed review comments on experiment results not being saved. Experiment results now have a persisted comment field, and updateExperimentResult accepts a comment alongside status and tags. Fixes https://github.com/mastra-ai/mastra/issues/19857

```ts
const experimentsStore = await storage.getStore('experiments');
await experimentsStore.updateExperimentResult({
  id: resultId,
  experimentId,
  comment: 'Agent hallucinated an API that does not exist',
});
```
