---
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Added `agentCallOptions` to the trigger experiment endpoint (`POST /datasets/:datasetId/experiments`) and `client.triggerDatasetExperiment()`, so you can tweak an agent's instructions, model, and sampling settings for a single experiment run from the API. Unknown keys are rejected.

```ts
await client.triggerDatasetExperiment({
  datasetId: 'dataset-id',
  targetType: 'agent',
  targetId: 'support-agent',
  agentCallOptions: {
    instructions: 'Answer in two sentences or fewer.',
    model: { provider: 'anthropic', modelId: 'claude-sonnet-5-5' },
    modelSettings: { temperature: 0.2 },
  },
});
```
