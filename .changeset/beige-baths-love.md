---
'@mastra/libsql': minor
---

Added support for the experimental workflow `storageVersion: 2` option. Runs of workflows that set it are stored as a run header plus one row per step, and each write saves only what changed instead of rewriting the whole run: the steps that changed, and the changes to the workflow state. A nested workflow run stores its state as changes to the version of its parent's state it started from, and keeps that state when the parent run is deleted or pruned. This keeps writes small for long-running workflows and loops.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  options: { storageVersion: 2 },
});
```

`init()` creates the new `mastra_workflow_runs` and `mastra_workflow_run_entries` tables. Existing runs keep working and are listed together with version 2 runs. Retention removes old version 2 runs along with their entries. Requires `@mastra/core` 1.78.0 or newer.
