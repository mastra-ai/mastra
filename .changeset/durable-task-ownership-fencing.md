---
'@mastra/core': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/convex': minor
'@mastra/dynamodb': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
'@mastra/upstash': minor
---

Fence background task execution with a persisted, expiring ownership lease.

Previously the owner of a running background task lived only in process memory, so a manager starting up could reclaim a task another live manager was still running. `recoverStaleTasks()` reset every `running` task to `pending` without checking whether the owner was alive, and terminal writes were unconditional, so a superseded worker could still commit a result.

Tasks now carry two persisted fields, `ownerId` and `leaseExpiresAt`, and storage `updateTask()` accepts `expectedOwnerId` / `expectedLeaseExpiresAt` to make a write conditional on the current owner and lease:

```ts
await storage.updateTask(
  taskId,
  { status: 'completed', result },
  { expectedStatus: 'running', expectedOwnerId: manager.ownerId },
);
```

The manager claims a task by stamping an owner and lease as part of its existing compare-and-set dispatch, renews the lease on a heartbeat (`leaseDurationMs`, default 30s, renewed every 10s), releases it on graceful shutdown, and fences every terminal-state write in the task workflow so a worker that lost ownership cannot commit. Startup recovery now reclaims only tasks whose lease has lapsed, and schedules a follow-up sweep when the earliest outstanding lease expires.

Storage adapters gained the two columns (migrated in place for existing tables) and the two new write conditions. `recoverStaleTasksOnStart` keeps its default of `true`, which is now safe because recovery is lease-fenced.