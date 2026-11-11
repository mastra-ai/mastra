---
'@mastra/core': patch
---

Improved the boot-time workflow restart (`restartAllActiveWorkflowRuns()`) for deployments with many active runs (#28712). It now reads active runs a page at a time instead of all at once, and skips runs another instance is still running without loading them.

`restartAllActiveWorkflowRuns()` now resolves once each evented run is handed to the workers, not when it finishes. A long evented run no longer holds a `recovery.workflowConcurrency` slot or delays the restart of the others.

Storage adapters can implement `getRunOwnerships({ runIds })` to read the ownership of many runs in one call. It returns a `Map` keyed by run ID and leaves out runs that were never claimed. Adapters that don't implement it read each run separately.

```ts
const owners = await workflowsStore.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners.get('run-1')?.live; // true while another instance holds the run
owners.has('run-2'); // false when run-2 was never claimed
```

Adapters whose `listWorkflowRuns` filters, orders and pages by `createdAt` in the backend can return `true` from `listsWorkflowRunsByCreatedAt()`. The restart then pages through their runs; other adapters are read once in full.
