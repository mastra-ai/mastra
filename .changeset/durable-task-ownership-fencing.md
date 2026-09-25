---
'@mastra/core': minor
---

Fence background task execution with a persisted, expiring ownership lease.

Several managers can now share one storage without running the same task twice. A running task records which worker owns it and when that ownership lapses, recovery only reclaims a task whose lease has expired, and a worker that lost ownership can no longer save a result — so a stale run cannot overwrite the current owner's outcome.

Configure the lease length with `leaseDurationMs`:

```ts
const mastra = new Mastra({
  backgroundTasks: { enabled: true, leaseDurationMs: 30_000 },
});
```

`recoverStaleTasksOnStart` keeps its default of `true`, which is now safe because recovery is lease-fenced.

Storage writes can additionally be made conditional on the current owner and lease:

```ts
await storage.updateTask(
  taskId,
  { status: 'completed', result },
  { expectedStatus: 'running', expectedOwnerId: 'worker-1' },
);
```

The new write conditions are only enforced by storage adapters that understand them. On an older storage package the manager still runs, but the conditions are ignored and writes fall back to unfenced behaviour — so upgrade the storage package alongside `@mastra/core` to get the guarantee.
