---
'@mastra/core': minor
---

Added a workflow recovery loop (#28712). An instance that calls `startWorkers()` with the orchestration worker, such as a server or a `mastra worker` process, now keeps restarting workflow runs whose instance stopped while it runs, with the same rule as the boot-time restart. Before, a run whose instance crashed after the other instances booted stayed `running` until the next boot.

- A run whose instance crashed is restarted about `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) plus `recovery.workflowGraceMs` after that instance last worked on it.
- A run whose instance called `shutdown()` is restarted about `recovery.workflowGraceMs` after the shutdown, 2 seconds with the in-process pubsub.

The first check runs when the workers start, and the server's boot-time `restartAllActiveWorkflowRuns()` call joins it. Later checks run every `recovery.workflowScanIntervalMs` (60 seconds by default), or sooner when a run the last check saw can be restarted earlier. Each check lists the active runs of every workflow recovery restarts, so raise the interval when you run many instances or keep many runs active:

```ts
export const mastra = new Mastra({
  recovery: {
    workflowScanIntervalMs: 2 * 60_000,
  },
});
```

The loop stops on `stopWorkers()` and `shutdown()`, needs a storage adapter with run-ownership support, and is off with `recovery.workflows: 'off'`, like the boot-time restart. A run that `restartAllActiveWorkflowRuns()` leaves alone because it is still running or within its grace period is now picked up by the loop instead of a timer of its own, so an instance that never calls `startWorkers()` doesn't look at it again.
