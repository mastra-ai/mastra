---
'@mastra/core': minor
---

Fence background task execution with a persisted, expiring ownership lease.

Previously the owner of a running background task lived only in process memory, so a manager starting up could reclaim a task that another live manager was still running: `recoverStaleTasks()` reset every `running` task to `pending` without checking whether the owner was alive, and terminal writes were unconditional, so a superseded worker could still commit a result.

Tasks now carry two persisted fields, `ownerId` and `leaseExpiresAt`, and storage `updateTask()` accepts `expectedOwnerId` / `expectedLeaseExpiresAt` to make a write conditional on the current owner and lease:

```ts
await storage.updateTask(
  taskId,
  { status: 'completed', result },
  { expectedStatus: 'running', expectedOwnerId: 'worker-1' },
);
```

The manager claims a task by stamping an owner and lease as part of its existing compare-and-set dispatch, renews the lease on a heartbeat (`leaseDurationMs`, default 30s, renewed every 10s), releases it on graceful shutdown, and fences every terminal-state write in the task workflow so a worker that lost ownership cannot commit. Startup recovery now reclaims only tasks whose lease has lapsed, and schedules a follow-up sweep when the earliest outstanding lease expires. `recoverStaleTasksOnStart` keeps its default of `true`, which is now safe because recovery is lease-fenced.

The new write conditions are only enforced by storage adapters that understand them. On an older storage package the manager still runs, but the conditions are ignored and writes fall back to unfenced behaviour — so upgrade the storage package alongside `@mastra/core` to get the guarantee.