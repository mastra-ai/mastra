---
'@mastra/core': patch
'@mastra/libsql': patch
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

Added `loadWorkflowRunStatus()`, which reads only a run's status. The in-memory and LibSQL stores override it; other stores fall back to loading the snapshot.
