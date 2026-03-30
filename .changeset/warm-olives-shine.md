---
'@mastra/evals': patch
'@mastra/core': patch
---

**Configurable weights**: Add `weights` option to `createTrajectoryScorerCode` for controlling how dimension scores are combined. Defaults to `{ accuracy: 0.4, efficiency: 0.3, toolFailures: 0.2, blacklist: 0.1 }`.

```ts
const scorer = createTrajectoryScorerCode({
  defaults: { steps: [{ name: 'search' }], maxSteps: 5 },
  weights: { accuracy: 0.6, efficiency: 0.2, toolFailures: 0.1, blacklist: 0.1 },
});
```

**ExpectedStep redesign**: `ExpectedStep` is now a discriminated union mirroring `TrajectoryStep`. When you specify a `stepType`, you get autocomplete for that variant's fields (e.g., `toolArgs` for `tool_call`, `modelId` for `model_generation`). The old `data: Record<string, unknown>` field is replaced by direct variant fields.

```ts
// Before: { name: 'search', stepType: 'tool_call', data: { input: { query: 'weather' } } }
// After:
{ name: 'search', stepType: 'tool_call', toolArgs: { query: 'weather' } }
```

**Remove `compareStepData`**: The `compareStepData` option is removed from `compareTrajectories`, `TrajectoryExpectation`, and all scorers. Data fields are now auto-compared when present on expected steps — if you specify `toolArgs` on an `ExpectedStep`, it will be compared against the actual step. If you omit it, only name and stepType are matched.

Also fixes documentation inaccuracies in `trajectory-accuracy.mdx` and `scorer-utils.mdx`.
