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

Added an optional `expectedStatus` guard to `persistWorkflowSnapshot`. Custom workflow stores that honor it atomically should return `true` from `supportsGuardedSnapshotWrites()`:

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
