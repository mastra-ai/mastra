---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
'@mastra/convex': minor
---

Added one-off and bounded schedules for agents and workflows. Pass `runAt` instead of `cron` to fire a schedule once, or pass `endAt` with `cron` to stop a recurring schedule after a given time. Finished schedules move to the new `completed` status.

```typescript
await mastra.schedules.create({ workflowId: 'send-report', runAt: new Date('2026-12-01T09:00:00Z') });
await mastra.schedules.create({ workflowId: 'digest', cron: '0 9 * * *', endAt: new Date('2027-01-01') });
```
