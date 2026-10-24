---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/dsql': patch
'@mastra/cloudflare-d1': patch
---

Fixed default workflow runs continuing to later steps and overwriting their status with success after another process canceled the run through shared storage.

Added an optional `expectedStatus` guard to `persistWorkflowSnapshot`. The in-memory, LibSQL, PostgreSQL, MySQL, MSSQL, DSQL, and Cloudflare D1 stores check the guard in the same statement as the write, so a cancellation can't be overwritten. Other stores read the run status just before writing, which leaves a short window where a cancellation can still be lost. Custom workflow stores that honor the guard atomically should return `true` from `supportsGuardedSnapshotWrites()`:

```ts
const written = await store.persistWorkflowSnapshot({
  workflowName,
  runId,
  snapshot,
  expectedStatus: ['running', 'success'],
});
// `written` is false when the stored status is not in the list
```

Added `loadWorkflowRunStatus()`, which reads only a run's status. The in-memory, LibSQL, PostgreSQL, MySQL, MSSQL, DSQL, and Cloudflare D1 stores read only the stored status instead of the whole snapshot; other stores fall back to loading the snapshot.
