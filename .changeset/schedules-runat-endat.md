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

Added one-off and bounded schedules for agents and workflows. Pass `runAt` instead of `cron` to fire a schedule once, or pass `endAt` with `cron` to stop a recurring schedule after a given time. Finished schedules use the existing `completed` status when they have no automatic fires remaining. Declarative workflow schedules (`createWorkflow({ schedule })`) accept `runAt` and `endAt` too, and schedule hooks receive `trigger.kind: 'once'` for a scheduled fire of a one-off agent schedule.

**TypeScript compatibility:** `cron` is now optional on schedule records and create/update inputs because one-off schedules use `runAt` instead. Strict consumers that read `schedule.cron` must first check that it is defined.

```typescript
await mastra.schedules.create({ workflowId: 'send-report', runAt: new Date(Date.now() + 60 * 60 * 1000) });
await mastra.schedules.create({ workflowId: 'digest', cron: '0 9 * * *', endAt: new Date('2027-01-01') });
```
