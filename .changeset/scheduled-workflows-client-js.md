---
'@mastra/client-js': minor
---

Added schedule methods to the client for the new scheduled workflows feature.

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

const schedules = await client.listSchedules({ workflowId: 'daily-report' });
const schedule = await client.getSchedule('wf_daily-report');
const triggers = await client.listScheduleTriggers('wf_daily-report', { limit: 50 });

await client.pauseSchedule('wf_daily-report');
await client.resumeSchedule('wf_daily-report');
```

Pause is durable across redeploys. Resume recomputes the next fire time from now so a long-paused schedule does not fire a backlog.
