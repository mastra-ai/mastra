---
'@mastra/core': minor
---

**Renamed heartbeats to schedules.** Agent heartbeats and workflow schedules are now one unified Schedules API: `mastra.schedules` manages both. The name "heartbeat" implied a liveness check; these are cron-based agent schedules, so they are now simply called schedules.

**Before**

```ts
const hb = await mastra.heartbeats.create({
  agentId: 'chef',
  cron: '0 9 * * *',
  prompt: 'Suggest a dish of the day',
});

await mastra.heartbeats.pause(hb.id);
```

**After**

```ts
// Schedule an agent (was a heartbeat)
const schedule = await mastra.schedules.create({
  agentId: 'chef',
  cron: '0 9 * * *',
  prompt: 'Suggest a dish of the day',
});

// Schedule a workflow with the same API
await mastra.schedules.create({
  workflowId: 'daily-report',
  cron: '0 6 * * *',
  inputData: { region: 'us' },
});

await mastra.schedules.pause(schedule.id);
```

What changed:

- `mastra.heartbeats` is now `mastra.schedules` and also creates, lists, updates, pauses, resumes, runs, and deletes workflow schedules. Results are discriminated by `agentId` vs `workflowId`.
- The Mastra config option `heartbeat: { ... }` (lifecycle hooks) is now `schedules: { ... }`, and hook types were renamed (`HeartbeatHooks` → `ScheduleHooks`, `HeartbeatPrepareContext` → `SchedulePrepareContext`, and so on).
- New agent schedule ids use the `agent_` prefix instead of `hb_`. Existing `hb_` ids keep working.
- The default signal tag an agent receives on a fire is now `<schedule>` instead of `<heartbeat>`.
- Types renamed: `Heartbeat` → `AgentSchedule`, `CreateHeartbeatInput` → `CreateAgentScheduleInput`, `HeartbeatScheduleTarget` → `AgentScheduleTarget` (persisted `target.type` is now `'agent'` instead of `'heartbeat'`).

Existing schedules stored in your database keep working: rows persisted with the old `target.type: 'heartbeat'` are read as `'agent'` automatically and keep firing.
