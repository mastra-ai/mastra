---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'mastra': patch
---

Added `agentModel` to `dataset.startExperiment()` and `dataset.startExperimentAsync()` so you can run an agent experiment against a different model without editing or versioning the agent. The model applies only to that run: the registered agent, its sub-agents and other experiments running at the same time keep their own models, and the agent version is picked the same way as without `agentModel`.

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  agentModel: 'anthropic/claude-haiku-5-5',
  scorers: ['accuracy'],
});
```

`agentModel` works only with agent targets and is rejected before an experiment record is created otherwise. It is not saved on the experiment record, so put it in `metadata` if you want to keep track of it. Each run's trace metadata includes `agentModel` (for example `anthropic/claude-haiku-5-5`), so you can tell override runs apart in traces.
