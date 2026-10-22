---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `agentModel` to experiments so you can run an agent target on a different model without changing the registered agent. The agent is forked for the run, so other callers keep using its configured model.

```ts
await client.triggerDatasetExperiment({
  datasetId,
  targetType: 'agent',
  targetId: 'support-agent',
  agentModel: { provider: 'openai', modelId: 'gpt-4.1-mini' },
});
```

`agentModel` is optional and only applies to agent targets. Passing it for a workflow or scorer target, or on a create-only experiment (`start: false`), is rejected.
