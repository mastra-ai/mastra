---
'@mastra/core': minor
---

Added `targetOptions` parameter to `runEvals` that is forwarded directly to `agent.generate()` (modern path) or `workflow.run.start()`. Also added per-item `startOptions` field to `RunEvalsDataItem` for per-item workflow options like `initialState`.

**New feature: `targetOptions`**

Pass agent execution options (e.g. `maxSteps`, `modelSettings`, `instructions`) through to `agent.generate()`, or workflow run options (e.g. `perStep`, `outputOptions`) through to `workflow.run.start()`:

```ts
// Agent - pass modelSettings or maxSteps
await runEvals({
  data,
  scorers,
  target: myAgent,
  targetOptions: { maxSteps: 5, modelSettings: { temperature: 0 } },
});

// Workflow - pass run options
await runEvals({
  data,
  scorers,
  target: myWorkflow,
  targetOptions: { perStep: true },
});
```

**New feature: per-item `startOptions`**

Supply per-item workflow options (e.g. `initialState`) directly on each data item:

```ts
await runEvals({
  data: [
    { input: { query: 'hello' }, startOptions: { initialState: { counter: 1 } } },
    { input: { query: 'world' }, startOptions: { initialState: { counter: 2 } } },
  ],
  scorers,
  target: myWorkflow,
});
```

Per-item `startOptions` take precedence over global `targetOptions` for the same key. Runeval-managed options (`scorers`, `returnScorerData`, `requestContext`) cannot be overridden via `targetOptions`.
