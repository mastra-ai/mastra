---
'@mastra/client-js': minor
---

**Added unified schedule methods and deprecated heartbeat methods.** The client now manages agent schedules (previously heartbeats) and workflow schedules through one set of methods backed by `/api/schedules`.

Added `createSchedule()`, `updateSchedule()`, `deleteSchedule()`, and `runSchedule()`, alongside the existing `listSchedules()`, `getSchedule()`, `pauseSchedule()`, `resumeSchedule()`, and `listScheduleTriggers()`. `ScheduleResponse.target` is now a discriminated union of agent and workflow targets.

```ts
// Schedule an agent (was createHeartbeat)
const schedule = await client.createSchedule({
  agentId: 'chef',
  cron: '0 9 * * *',
  prompt: 'Suggest a dish of the day',
});

// Schedule a workflow with the same method
await client.createSchedule({
  workflowId: 'daily-report',
  cron: '0 6 * * *',
});
```

Deprecated `listHeartbeats()`, `getHeartbeat()`, `createHeartbeat()`, `updateHeartbeat()`, `deleteHeartbeat()`, `pauseHeartbeat()`, `resumeHeartbeat()`, and `runHeartbeat()`. They now delegate to the schedule methods and will be removed in a future release.
