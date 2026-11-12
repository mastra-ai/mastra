---
'@mastra/core': minor
---

`restartAllActiveWorkflowRuns()` now restarts only workflow runs that stopped (#28712). A `running` or `waiting` run counts as stopped when no instance is running it and nothing about the run changed for `recovery.workflowGraceMs`. A run that stopped more recently is checked again once its grace period ends. Without run fencing in the store, every active run is still restarted, as before.

```ts
const mastra = new Mastra({
  // Defaults to 2 seconds with the default in-process pubsub, and 60 seconds with any other pubsub.
  recovery: { workflowGraceMs: 30_000 },
});
```

Set the grace period above the longest time your pubsub can hold an event before a worker takes it. Otherwise a run whose next event is still queued in the pubsub can be restarted. With a broker pubsub, a recovery restart during a backlog longer than the lease TTL plus `workflowGraceMs` can run a step again whose result the run hadn't saved yet.

Recovery is also faster when many runs are active: it reads the snapshot of a run only when it restarts it. With 3,000 active runs that another instance is running, among 30,000 finished runs, a call takes about 30 ms instead of 1.7 s on Postgres and 60 ms instead of 670 ms on LibSQL.

For evented workflows, `restartAllActiveWorkflowRuns()` returns once each restart is handed to the workers instead of waiting for the runs to finish. `shutdown()` doesn't wait for those runs either. A call made while another is still starting its restarts joins that call.

`shutdown()` now waits, within `drainTimeout`, for the default-engine runs a recovery call is restarting.

A default-engine nested run resumed directly now keeps its parent from being restarted while it runs. On stores without atomic status updates, it keeps itself from being restarted instead.

Storage adapter authors can implement `getRunOwnerships({ runIds })` to read the ownership of many runs in one call. It returns a `Map` keyed by run ID and leaves out runs that were never claimed. Adapters that don't implement it read each run separately.

```ts
const owners = await workflowsStore.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners.get('run-1')?.live; // true while another instance holds the run
owners.has('run-2'); // false when run-2 was never claimed
```
