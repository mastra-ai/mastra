---
'@mastra/pg': minor
---

Added support for the experimental workflow `storageVersion: 2` option. Runs of workflows that set it are stored as a run header plus one row per step, and each write saves only the steps that changed instead of rewriting the whole run. This keeps writes small for long-running workflows and loops.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

`init()` creates the new `mastra_workflow_runs` and `mastra_workflow_run_entries` tables, and the exported schema includes them. Existing runs keep working and are listed together with version 2 runs. Retention removes old version 2 runs along with their entries. Requires `@mastra/core` 1.78.0 or newer.
