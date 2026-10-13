---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': patch
'@mastra/core': patch
---

Added `targetType` to experiment results. The result `output` is now typed based on the target, so checking `targetType` gives you typed agent and scorer outputs:

```ts
const { results } = await client.listDatasetExperimentResults(datasetId, experimentId);

for (const result of results) {
  if (result.targetType === 'agent') {
    console.log(result.output?.text, result.output?.error?.message);
  } else if (result.targetType === 'scorer') {
    console.log(result.output?.score);
  }
}
```

Workflow, processor, and caller-driven results (`targetType: null`) keep `output` as `unknown`.
