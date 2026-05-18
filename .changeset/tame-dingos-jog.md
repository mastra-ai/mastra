---
'@mastra/convex': minor
---

Workflow schedules can now be stored in Convex.

```ts
import { ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'app-storage',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});

const schedules = await storage.getStore('schedules');

await schedules?.createSchedule({
  id: 'daily-summary',
  target: { type: 'workflow', workflowId: 'summary-workflow' },
  cron: '0 9 * * *',
  status: 'active',
  nextFireAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```
