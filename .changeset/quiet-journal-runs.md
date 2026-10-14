---
'@mastra/core': patch
---

Added an experimental `storageVersion` workflow option. With `storageVersion: 2`, each run is stored as a header plus one entry per step, and each write saves only the steps that changed instead of rewriting the whole run. This cuts storage writes for long workflows and loops.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

Version 2 works only with in-memory storage and the default engine for now. Inside version 2 runs, use `await getStepResultAsync(step)` instead of `getStepResult(step)`. Runs keep the version they were created with, so resuming a run after changing this option throws.
