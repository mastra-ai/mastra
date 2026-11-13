---
'@mastra/core': minor
---

Added a workflow recovery loop. A default-engine workflow run whose instance crashed is now restarted without waiting for another instance to boot (#28712).

`startWorkers()` starts the loop on an instance that runs the orchestration worker. Every `recovery.workflowScanIntervalMs` (60 seconds by default, give or take a fifth), it restarts the default-engine runs that stopped, by the same rule as `restartAllActiveWorkflowRuns()`. A crashed instance's run is restarted about `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) plus `recovery.workflowGraceMs` after the crash, at the next pass.

Instances that share a storage adapter elect one leader through a lease row in storage, and only the leader lists runs. The leader keeps the role until its `stopWorkers()` or `shutdown()` hands it back, or its lease expires after a crash. A `restartAllActiveWorkflowRuns()` call on another instance leaves default-engine runs to the leader, and still restarts the evented runs recovery covers.

```ts
const mastra = new Mastra({
  recovery: { workflowScanIntervalMs: 30_000 },
});
```

The loop never restarts evented runs, and doesn't run when `recovery.workflows` is `'off'` or on a storage adapter without run-ownership support. `restartAllActiveWorkflowRuns()` no longer schedules a check of its own for runs it found live or in their grace period; the loop looks at them again.
