---
'@mastra/core': minor
---

`restartAllActiveWorkflowRuns()` now restarts only workflow runs that stopped (#28712). A `running` or `waiting` run counts as stopped when no instance is running it and nothing about the run changed for `recovery.workflowGraceMs`. A run that stopped more recently is checked again once its grace period ends. Without run fencing in the store, every active run is still restarted, as before.

```ts
const mastra = new Mastra({
  // Defaults to 60 seconds with a broker pubsub, and 2 seconds with the in-process pubsub.
  recovery: { workflowGraceMs: 30_000 },
});
```

Set the grace period above the longest time your pubsub can hold an event before a worker takes it. Otherwise a run whose next event is still queued in the pubsub can be restarted.

Recovery is also faster when many runs are active: it reads the snapshot of a run only when it restarts it. With 3,000 active runs that another instance is running, among 30,000 finished runs, a call takes about 30 ms instead of 1.7 s on Postgres and 60 ms instead of 670 ms on LibSQL.

For evented workflows, `restartAllActiveWorkflowRuns()` resolves once each restart is published to the workers, without waiting for the runs to finish, and nothing keeps waiting for those runs afterwards, so `shutdown()` does not wait for them either. Calls made while another call is in progress share it.

A default-engine nested run resumed directly now keeps its parent from being restarted while it runs.

Storage adapter authors can implement `getRunOwnerships({ runIds })` to read the ownership of many runs in one call. It returns a `Map` keyed by run ID and leaves out runs that were never claimed. Adapters that don't implement it read each run separately.

```ts
const owners = await workflowsStore.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners.get('run-1')?.live; // true while another instance holds the run
owners.has('run-2'); // false when run-2 was never claimed
```
