---
'@mastra/client-js': minor
---

Added `agentModel` to `triggerDatasetExperiment()` to run an agent experiment against a different model.

```ts
await client.triggerDatasetExperiment({
  datasetId: 'dataset-1',
  targetType: 'agent',
  targetId: 'support-agent',
  agentModel: { provider: 'anthropic', modelId: 'claude-haiku-5-5' },
});
```
