---
'@mastra/core': minor
---

Added the `WorkflowScheduler` component that drives cron-based workflow triggers. This is the third increment toward built-in scheduled workflows.

The scheduler is constructable on its own and tested in isolation. It is **not yet auto-instantiated by Mastra** — wiring into the Mastra lifecycle (and the engine-routing rule for declarative `schedule` configs) lands in the next release.

**What it does:**

- On each tick, polls `SchedulesStorage.listDueSchedules` for rows with `nextFireAt <= now`
- Computes the next fire time from the cron expression (timezone-aware via `croner`)
- Atomically advances `nextFireAt` via compare-and-swap (`updateScheduleNextFire`) so only one instance across many polling the same storage can claim a fire
- Publishes a `workflow.start` event on the existing `workflows` pubsub topic — the existing `WorkflowEventProcessor` consumes it and runs the workflow
- Records every trigger attempt in the schedule's history (`recordTrigger`)

**Lifecycle:**

```ts
const scheduler = new WorkflowScheduler({ schedulesStore, pubsub });
await scheduler.start();
// ...tick loop runs every `tickIntervalMs` (default 10s)
await scheduler.stop();
```

The scheduler does not execute workflows itself — it only publishes triggers. RunIds are derived deterministically from the schedule id and the scheduled fire time so concurrent ticks across processes never produce divergent runs.
