---
'@mastra/core': patch
---

Fixed evented workflows running a step once per instance when several instances start at the same time (#28712).

**Restarting a run another instance is running**

`restart()` on an evented run throws `WORKFLOW_RESTART_RUN_OWNED` while another instance is starting the run or running one of its steps, including a step of a nested workflow. The boot-time restart skips such a run and tries it again later. If you call `restart()` yourself, catch the error and retry after `details.leaseExpiresAt`, which is up to `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) after the run's last step:

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

**Duplicate step deliveries**

Concurrent `restart()` calls on one run restart it once. A step whose event is delivered again while an instance runs it waits for that instance instead of running beside it. If that instance stops, another instance runs the step once `MASTRA_AGENT_THREAD_LEASE_TTL_MS` has passed since the stopped instance last vouched for it. Workflows with `autoRestartActiveRuns: false` are unchanged. This needs a storage adapter with run-ownership support.

**Storage growth**

Evented runs store one `workflows.runOwnership` record per step they run, including each loop iteration and `foreach` item. To prune them, set a `workflows.runOwnership` retention policy and schedule `prune()` as described in [storage retention](https://mastra.ai/reference/storage/retention).
