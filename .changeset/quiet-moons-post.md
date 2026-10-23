---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': patch
'@mastra/core': patch
'mastra': patch
---

Added an `agentModel` option to `POST /datasets/:datasetId/experiments`, `triggerDatasetExperiment()` in the client SDK and `useDatasetMutations().triggerExperiment` in `@mastra/react`. It runs an agent experiment against a different model without changing the agent.

```ts
await client.triggerDatasetExperiment({
  datasetId: 'dataset-1',
  targetType: 'agent',
  targetId: 'support-agent',
  agentModel: { provider: 'anthropic', modelId: 'claude-haiku-5-5' },
});
```

The request is rejected when `targetType` is not `"agent"` or when `start` is `false`.
