---
'@mastra/core': patch
---

Fixed default workflow runs continuing to later steps and overwriting their status with success after another process canceled the run through shared storage.

Added an optional `expectedStatus` guard to `persistWorkflowSnapshot`. Stores that check it in the same statement as the write can't overwrite a cancellation. Other stores read the run status just before writing, which leaves a short window where a cancellation can still be lost. Custom workflow stores that honor the guard atomically should return `true` from `supportsGuardedSnapshotWrites()`:

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
