---
'@mastra/core': minor
---

Added scheduled workflows. Declare a `schedule` on `createWorkflow` and Mastra fires the workflow on cron with no extra wiring.

```typescript
import { createWorkflow } from '@mastra/core/workflows';

const dailyReport = createWorkflow({
  id: 'daily-report',
  inputSchema: z.object({ date: z.string() }),
  outputSchema: z.object({ summary: z.string() }),
  schedule: {
    cron: '0 9 * * *',
    timezone: 'America/Los_Angeles',
    inputData: { date: 'today' },
  },
})
  .then(/* steps */)
  .commit();
```

A workflow with a `schedule` is auto-promoted to the evented engine, so scheduled fires share the same execution path as manual `start()` calls. `inputData`, `initialState`, and `requestContext` on the schedule are type-checked against the workflow's schemas at definition time. Pass an array of schedules with stable `id`s to fire one workflow on multiple crons.

Mastra auto-instantiates a `WorkflowScheduler` when any registered workflow declares a `schedule`. The scheduler claims due schedules via compare-and-swap, so multiple instances polling the same storage cannot double-fire. Projects with no scheduled workflows pay zero cost. Configure with `new Mastra({ scheduler: { tickIntervalMs, batchSize, enabled, onError } })`.

Requires a storage adapter that implements the new `schedules` domain (`@mastra/libsql` and `@mastra/pg` ship adapters; `InMemorySchedulesStorage` is included for tests). Adds a `croner` dependency.
