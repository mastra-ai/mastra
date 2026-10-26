---
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Added `agentOverrides` to the trigger experiment endpoint (`POST /datasets/:datasetId/experiments`) and `client.triggerDatasetExperiment()`, so you can tweak an agent's instructions, model, and execution options for a single experiment run from the API.

```ts
await client.triggerDatasetExperiment({
  datasetId: 'dataset-id',
  targetType: 'agent',
  targetId: 'support-agent',
  agentOverrides: {
    instructions: 'Answer in two sentences or fewer.',
    model: { provider: 'anthropic', name: 'claude-sonnet-5-5' },
    defaultOptions: { modelSettings: { temperature: 0.2 }, maxSteps: 3 },
  },
});
```
