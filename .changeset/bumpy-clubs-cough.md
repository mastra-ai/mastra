---
'@mastra/core': patch
---

Fixed evented workflows running a step once per instance when several instances start at the same time (#28712).

**Restarting a run another instance is running**

`restart()` on an evented run throws `WORKFLOW_RESTART_RUN_OWNED` while another instance is working on the run: starting it, running one of its steps, moving between steps, or running a nested workflow it started. The boot-time restart skips such a run, and the recovery loop restarts it once it stops. If you call `restart()` yourself, catch the error and retry after `details.leaseExpiresAt`:

```ts
import { MastraError } from '@mastra/core/error';

try {
  await run.restart();
} catch (error) {
  if (error instanceof MastraError && error.id === 'WORKFLOW_RESTART_RUN_OWNED') {
    // Another instance is running this run. Try again after this time.
    console.log(error.details?.leaseExpiresAt);
  } else {
    throw error;
  }
}
```

Runs of an instance that calls `shutdown()` stay with it until `shutdown()` finishes draining (`drainTimeout`). `restart()` on another instance can take them right after; recovery restarts them one `recovery.workflowGraceMs` later. Runs of an instance that stops without calling `shutdown()` can be taken by `restart()` on another instance `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) after that instance last worked on them, and recovery restarts them one `recovery.workflowGraceMs` after that.

**Duplicate step deliveries**

Concurrent `restart()` calls on one run restart it once. A step whose event is delivered again while an instance runs it waits for that instance instead of running beside it. If that instance stops, the waiting delivery runs the step once the stopped instance's claim on it expires, `MASTRA_AGENT_THREAD_LEASE_TTL_MS` after it last renewed it. Workflows with `autoRestartActiveRuns: false` are unchanged. This needs a storage adapter with run-ownership support.

**Storage growth**

Evented runs store one `workflows.runOwnership` record per step they run, including each loop iteration and `foreach` item. To prune them, set a `workflows.runOwnership` retention policy and schedule `prune()` as described in [storage retention](https://mastra.ai/reference/storage/retention).
