---
'@mastra/core': patch
---

Fixed default workflow runs continuing to later steps and overwriting their status with success after another process canceled the run through shared storage. This covers sequential steps, sleeps, resumed parallel branches, and `dountil`, `dowhile` and `foreach` loops. Loops now stop at the iteration where the cancellation is seen instead of running to completion.

Added an optional `expectedStatus` guard to `persistWorkflowSnapshot`. The in-memory, LibSQL, PostgreSQL, MySQL, MSSQL, DSQL and Cloudflare D1 stores check it in the same statement as the write, so they can't overwrite a cancellation. Other stores, such as MongoDB, read the run status just before writing, which leaves a short window where a cancellation can still be lost. Custom workflow stores that honor the guard atomically should return `true` from `supportsGuardedSnapshotWrites()`:

```ts
const written = await store.persistWorkflowSnapshot({
  workflowName,
  runId,
  snapshot,
  expectedStatus: ['running', 'success'],
});
// `written` is false when the stored status is not in the list
```

Added `loadWorkflowRunStatus()`, which reads only a run's status. Stores that don't override it fall back to loading the snapshot.

Added `WORKFLOW_RUN_STATUSES` and `isWorkflowRunStatus()` to `@mastra/core/storage` so custom stores can validate stored run statuses against the same list the engine uses.
