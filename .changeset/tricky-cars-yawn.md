---
'@mastra/core': minor
---

Fixed scheduled workflows hanging when started directly on serverless hosts (#18807). Declaring `schedule` on a workflow no longer switches it to the evented engine unless the `MASTRA_WORKERS` environment variable is set. Dev servers, single-process servers, and serverless hosts keep the default engine, so an HTTP-triggered `run.start()` runs in-process like any other workflow instead of waiting for a worker that never starts.

**What changes**

- Without `MASTRA_WORKERS`, scheduled workflows run on the default engine and no longer need storage with concurrent-update support. Cron fires run in-process on the host that runs the scheduler.
- With `MASTRA_WORKERS` set to any value (split-worker deployments), scheduled workflows still run on the evented engine, and Mastra logs a warning to the console when one is created. Set `MASTRA_WORKERS` on every process in a split deployment, including `false` on the API.
- `schedule` declared on Inngest workflows is ignored with a warning. Use Inngest's `cron` instead.

```typescript
import { createWorkflow } from '@mastra/core/workflows';

const dailyReport = createWorkflow({
  id: 'daily-report',
  schedule: { cron: '0 9 * * *' },
  // ...
}).commit();

// Before: dailyReport.engineType === 'evented', and run.start() hung without workers
// After (MASTRA_WORKERS unset): dailyReport.engineType === 'default'
const run = await dailyReport.createRun();
await run.start({ inputData }); // completes in-process
```

To keep a scheduled workflow on the evented engine everywhere, import `createWorkflow` from `@mastra/core/workflows/evented`.
