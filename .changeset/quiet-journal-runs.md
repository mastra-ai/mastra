---
'@mastra/core': minor
---

Added an experimental `storageVersion` workflow option. With `storageVersion: 2`, a run saves only what changed at each step instead of rewriting the whole run. This cuts storage writes for long workflows and loops, including loops whose state grows every iteration.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

**Limitations**

- Version 2 requires the default or evented engine and a storage adapter that supports it: in-memory, `@mastra/pg`, or `@mastra/libsql`. Creating a run on another adapter throws.
- Inside version 2 runs, use `await getStepResultAsync(step)` instead of `getStepResult(step)`.
- A `shouldPersistSnapshot` predicate on a version 2 run sees earlier successful steps without their `output`.
- Workflow state is stored as JSON, so values such as `Date` are read back as strings, as with database storage.
- Runs keep the version they were created with: resuming a run after changing this option continues it in its stored version.
