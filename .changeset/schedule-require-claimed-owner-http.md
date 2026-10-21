---
'@mastra/server': patch
'@mastra/client-js': patch
---

The schedules HTTP API now accepts and returns `ifIdle.requireClaimedOwner` on agent schedules. Before this, `POST /schedules` and `PATCH /schedules/:scheduleId` dropped the flag, so a client that read a schedule and sent its `ifIdle` back cleared it.

```ts
await client.createSchedule({
  agentId: 'support',
  cron: '0 9 * * *',
  prompt: 'Morning check-in',
  threadId: 'thread-1',
  resourceId: 'user-1',
  ifIdle: { behavior: 'wake', requireClaimedOwner: true },
});
```
