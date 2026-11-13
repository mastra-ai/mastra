---
'@mastra/core': minor
---

`restartAllActiveWorkflowRuns()` no longer restarts evented workflow runs that a broker recovers on its own, and restarts a default-engine run only once it stopped (#28712).

**Evented runs on a broker.** With a pubsub whose broker redelivers a dead worker's unacked messages (Redis Streams, Valkey Streams, Google Cloud Pub/Sub), booting instances no longer restart evented runs. Before, every instance that booted restarted every active evented run, so steps ran again on several instances at once. Now the broker hands the stopped step's message to another worker, and the run goes on from there. Pubsub implementations report this through the new `redeliversUnacked` getter, which defaults to `false`.

With Redis or Valkey Streams, keep `reclaimIdleMs` at 30 seconds or more (the default is 60 seconds). A message reclaimed sooner can arrive while the dead worker's step fence is still held, and is then dropped as a duplicate.

Booting instances still restart these evented runs, each of them, as before:

- scheduled runs, whose events stay in the process that fired them
- runs on the default in-process `EventEmitterPubSub` or on the Unix socket pubsub. Several instances that share one storage aren't supported for evented workflows with these; use a broker.

**Known limits on a broker.** These evented runs stay `running` until you call `restart()` on them. Before, the next booting instance restarted them.

- A sleeping run whose instance exits, after a crash or during a normal deploy. The sleep's timer lives in that process.
- A run whose step message Redis or Valkey Streams trimmed. The streams trim to `maxStreamLength` entries (10,000 by default), pending ones included, so a step that is still running while that many newer events are published loses its message if its instance then exits. Raise `maxStreamLength` if you run long steps with a high event volume.
- A run whose message the broker dropped after `maxDeliveryAttempts` or `inFlightTimeoutMs`, a run whose failure couldn't be published after several attempts, and runs on a Redis instance that restarted without persistence.

**Default-engine runs.** A `running` or `waiting` run counts as stopped when no instance holds its run lease and neither the run nor that lease changed for `recovery.workflowGraceMs` (2 seconds by default). A run that stopped more recently is left to the workflow recovery loop that `startWorkers()` starts. Without run fencing in the store, every active run is still restarted, as before.

```ts
const mastra = new Mastra({
  recovery: { workflowGraceMs: 5_000 },
});
```

Recovery is also faster when many runs are active: it lists runs without their step results and reads a run's snapshot only when it restarts it. With 3,000 active runs that another instance holds, among 30,000 finished runs, a call takes about 30 ms instead of 1.8 s on Postgres and 45 ms instead of 630 ms on LibSQL. A call made while another is still handing out restarts joins that call, and `shutdown()` waits, within `drainTimeout`, for a recovery call in progress and the runs it is restarting.

A default-engine nested run resumed directly now keeps its parent from being restarted while it runs. On stores without atomic status updates, it keeps itself from being restarted instead.
