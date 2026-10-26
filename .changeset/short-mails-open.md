---
'@mastra/core': minor
---

Added `agentCallOptions` to experiments so you can try different instructions, a different model, or different sampling settings on an agent without editing it in code or in the editor. The options are passed to each `agent.generate()` call the experiment makes, layered over the agent's config (or the `agentVersion` it resolves to), so the registered agent and other running experiments are unaffected.

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  agentCallOptions: {
    instructions: 'Answer in two sentences or fewer.',
    model: 'anthropic/claude-sonnet-5-5',
    modelSettings: { temperature: 0.2 },
  },
});
```

The experiment's `metadata.agentCallOptions` records the options, so runs can be compared. Each run's trace records the model and settings, and flags overridden instructions with `agentInstructionsOverridden: true` instead of copying the prompt; the prompt itself is on the agent run span's `instructions` attribute.

`agentModel` is now an alias for `agentCallOptions.model` (which wins when both are set). The model it runs on is recorded as `metadata.agentCallOptions.model` instead of `metadata.agentModel`.
