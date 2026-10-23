---
'@mastra/core': minor
---

Added `agentModel` to `dataset.startExperiment()` and `dataset.startExperimentAsync()` so you can run an agent experiment against a different model without editing or versioning the agent. The model is passed with each call the experiment makes: the registered agent, its sub-agents and other experiments running at the same time keep their own models, and the agent version is picked the same way as without `agentModel`.

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  agentModel: 'anthropic/claude-haiku-5-5',
  scorers: ['accuracy'],
});
```

The experiment's `metadata.agentModel` and each run's trace metadata record the model (for example `anthropic/claude-haiku-5-5`), so runs on different models can be told apart. `agentModel` works only with agent targets and is rejected before an experiment record is created otherwise.
