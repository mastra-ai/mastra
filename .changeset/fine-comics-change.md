---
'@mastra/core': minor
---

Added a workflow recovery loop (#28712). An instance that calls `startWorkers()` with the orchestration worker, such as a server or a `mastra worker` process, now keeps restarting, while it runs, the workflow runs whose instance stopped, with the same rule as the boot-time restart. Before, a run that started after the other instances booted stayed `running` until the next boot if its instance crashed.

- A run whose instance crashed can be restarted once `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) plus `recovery.workflowGraceMs` passed since that instance last worked on it.
- A run whose instance called `shutdown()` can be restarted once `recovery.workflowGraceMs` passed since the shutdown. The grace period is 2 seconds with the default in-process pubsub and 60 seconds with another pubsub.

The first check runs when the workers start, and the server's boot-time `restartAllActiveWorkflowRuns()` call joins it. Later checks run every `recovery.workflowScanIntervalMs` (60 seconds by default), or sooner when a run the last check found stopped comes out of its grace period earlier. A run a check saw running is restarted within about one interval plus the lease TTL plus the grace period after its instance stops. Each check lists the active runs of every workflow that recovery restarts, so raise the interval when you run many instances or keep many runs active:

```ts
export const mastra = new Mastra({
  recovery: {
    workflowScanIntervalMs: 2 * 60_000,
  },
});
```

The loop stops on `stopWorkers()` and `shutdown()`, and is off with `recovery.workflows: 'off'`, like the boot-time restart. It needs a storage adapter with run-ownership support: without it, the loop restarts no runs, and only the boot-time call restarts every active run once. A run that `restartAllActiveWorkflowRuns()` leaves alone because it is still running or within its grace period is now picked up by the loop instead of a timer of its own, so an instance that never calls `startWorkers()` doesn't look at it again.
