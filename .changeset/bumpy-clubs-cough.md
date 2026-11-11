---
'@mastra/core': patch
---

Fixed evented workflows running a step once per instance when several instances start at the same time (#28712).

**Restarting a run another instance is running**

`restart()` on an evented run now throws `WORKFLOW_RESTART_RUN_OWNED` while an instance is starting the run or running one of its steps, including a step of a nested workflow. It keeps throwing until the run's lease expires, `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15 seconds by default) after the run's last step. The boot-time restart skips such a run and tries it again after that. The error carries the expiry time in `details.leaseExpiresAt`:

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

Concurrent `restart()` calls on one run now restart it once. A step delivered again while an instance runs it now waits for that instance instead of running beside it. If that instance stops, another instance runs the step once the step's lease expires, `MASTRA_AGENT_THREAD_LEASE_TTL_MS` after the stopped instance last renewed it. Workflows with `autoRestartActiveRuns: false` behave as before.

**Storage rows**

Evented runs now keep one `workflows.runOwnership` row per step occurrence, including each loop iteration and foreach item, plus two rows per run. To prune them, set a `workflows.runOwnership` policy and schedule `prune()` as described in [storage retention](https://mastra.ai/reference/storage/retention).
