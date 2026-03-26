---
'@mastra/evals': patch
---

Add configurable `weights` option to `createTrajectoryScorerCode` for controlling how dimension scores (accuracy, efficiency, tool failures, blacklist) are combined into the final score. Defaults to `{ accuracy: 0.4, efficiency: 0.3, toolFailures: 0.2, blacklist: 0.1 }`.

```ts
const scorer = createTrajectoryScorerCode({
  defaults: { steps: [{ name: 'search' }], maxSteps: 5 },
  weights: { accuracy: 0.6, efficiency: 0.2, toolFailures: 0.1, blacklist: 0.1 },
});
```

Also fixes several documentation inaccuracies in `trajectory-accuracy.mdx` and `scorer-utils.mdx` (incorrect default values, wrong property names, missing result fields).
