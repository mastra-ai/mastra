---
'@mastra/core': minor
---

Added a workflow recovery loop. A default-engine workflow run whose instance crashed is now restarted without waiting for another instance to boot (#28712).

`startWorkers()` starts the loop on an instance that runs the orchestration worker. Every `recovery.workflowScanIntervalMs` (60 seconds by default, give or take a fifth), it restarts the default-engine runs that stopped, by the same rule as `restartAllActiveWorkflowRuns()`. A crashed instance's run is restarted at the first pass after its lease (`MASTRA_AGENT_THREAD_LEASE_TTL_MS`, 15 seconds by default) expired and `recovery.workflowGraceMs` passed, so within about one scan interval of that.

Instances that share a storage adapter elect one loop leader through a lease row in storage, and only the leader's loop lists runs. The leader keeps the role until its `stopWorkers()` or `shutdown()` hands it back, or its lease expires after a crash. The leader applies to the loop only: `restartAllActiveWorkflowRuns()` at boot still restarts each instance's own stopped default-engine runs. The loop recovers only the workflows the leader registers, and a run it restarts executes on the leader.

```ts
const mastra = new Mastra({
  recovery: { workflowScanIntervalMs: 30_000 },
});
```

The loop never restarts evented runs, and doesn't run when `recovery.workflows` is `'off'` or on a storage adapter without run-ownership support. `restartAllActiveWorkflowRuns()` no longer schedules a check of its own for runs it found live or in their grace period; the loop looks at them again.
