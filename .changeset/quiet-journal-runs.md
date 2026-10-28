---
'@mastra/core': patch
---

Added an experimental `storageVersion` workflow option. With `storageVersion: 2`, each run is stored as a header plus one entry per step, and each write saves only what changed instead of rewriting the whole run: the steps that changed, and the changes to the workflow state. A nested workflow run stores its state as changes to its parent's. Runs also keep in memory only the step results the next step needs, and read older ones from storage when `getStepResultAsync` asks for them. This cuts storage writes and memory use for long workflows and loops, including loops whose state grows every iteration.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

Version 2 requires the default engine and a storage adapter that supports it: in-memory, `@mastra/pg`, or `@mastra/libsql`. Inside version 2 runs, use `await getStepResultAsync(step)` instead of `getStepResult(step)`. A `shouldPersistSnapshot` predicate on a version 2 run sees earlier successful steps without their `output`. Version 2 stores the workflow state as JSON, so values such as `Date` are read back as strings, as with database storage. A run keeps the version it was stored with, so a run resumed after changing this option continues in that version. A nested workflow's runs use their parent run's version.
