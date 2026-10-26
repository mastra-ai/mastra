---
'@mastra/core': minor
---

Added `agentOverrides` to experiments so you can try different instructions, a different model, or different execution options on an agent without editing it in code or in the editor. The tweak is applied to each call the experiment makes, so the registered agent and other running experiments are unaffected. The experiment's `metadata.agentOverrides` and each run's trace record the exact tweak, so runs can be compared.

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  agentOverrides: {
    instructions: 'Answer in two sentences or fewer.',
    model: { provider: 'anthropic', name: 'claude-sonnet-5-5' },
    defaultOptions: { modelSettings: { temperature: 0.2 }, maxSteps: 3 },
  },
});
```

The fields match a stored agent version's config, so a tweak that scores well can later be saved as a new agent version.
