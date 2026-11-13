---
'@mastra/core': minor
---

`restartAllActiveWorkflowRuns()` no longer restarts evented workflow runs that a broker recovers on its own, and restarts a default-engine run only once it stopped (#28712).

**Evented runs on a broker.** With a pubsub whose broker redelivers a dead worker's unacked messages (Redis Streams, Valkey Streams, Google Cloud Pub/Sub), booting instances no longer restart evented runs. Before, every instance that booted restarted every active evented run, so steps ran again on several instances at once. Now the broker hands the killed step's message to another worker, and the run goes on from there. Scheduled runs whose events stay in the process that fired them are still restarted. Pubsub implementations report this through the new `redeliversUnacked` getter, which defaults to `false`.

With Redis or Valkey Streams, keep `reclaimIdleMs` at 30 seconds or more (the default is 60 seconds). A message reclaimed sooner can arrive while the dead worker's step fence is still held, and is then dropped as a duplicate.

**Evented runs on the in-process pubsub.** The default `EventEmitterPubSub` delivers events only inside the process that published them, so evented runs on it are restarted at once, as before. Several instances that share one storage are not supported for evented workflows with this pubsub; use a broker.

**Default-engine runs.** A `running` or `waiting` run counts as stopped when no instance holds its run lease and neither the run nor that lease changed for `recovery.workflowGraceMs`. A run that stopped more recently is checked again once its grace period ends. Without run fencing in the store, every active run is still restarted, as before.

```ts
const mastra = new Mastra({
  // Defaults to 2 seconds with the default in-process pubsub, and 60 seconds with any other pubsub.
  recovery: { workflowGraceMs: 30_000 },
});
```

Recovery is also faster when many runs are active: it lists runs without their step results and reads a run's snapshot only when it restarts it. A call made while another is still handing out restarts joins that call, and `shutdown()` waits, within `drainTimeout`, for the runs a recovery call is restarting.

A default-engine nested run resumed directly now keeps its parent from being restarted while it runs. On stores without atomic status updates, it keeps itself from being restarted instead.
