---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

**Added** heartbeats: schedule an agent to run on a recurring cron, either inside an existing conversation thread or on its own.

A heartbeat fires a prompt to an agent on a schedule. When it has a thread, the run is delivered into that thread as a normal agent signal, so anything watching the thread sees it like any other message; without a thread, the agent just runs in isolation. Each heartbeat has its own id and an optional `name`, so one agent or thread can have several heartbeats with different schedules and prompts. Heartbeats are persisted, so they keep firing across process restarts with no extra setup.

```ts
const hb = await mastra.heartbeats.create({
  agentId: 'chef',
  name: 'morning-checkin',
  threadId,
  resourceId,
  cron: '*/5 * * * *',
  prompt: 'Check in on the user',
  ifActive: 'discard', // skip if the user is mid-conversation
  ifIdle: 'wake', // wake the agent if the thread is idle
});

// Threadless: run the agent on a cron with no conversation.
await mastra.heartbeats.create({
  agentId: 'chef',
  cron: '0 * * * *',
  prompt: 'Run the hourly summary',
});

await mastra.heartbeats.list({ agentId: 'chef' });
await mastra.heartbeats.get(hb.id);
await mastra.heartbeats.update(hb.id, { prompt: 'check in gently' });
await mastra.heartbeats.pause(hb.id);
await mastra.heartbeats.resume(hb.id);
await mastra.heartbeats.run(hb.id); // fire once now
await mastra.heartbeats.delete(hb.id);
```

The same CRUD is available over HTTP through `@mastra/server` (under `/heartbeats`) and as top-level methods on the `@mastra/client-js` client (`client.createHeartbeat`, `client.getHeartbeat`, `client.listHeartbeats`, etc.).

**Lifecycle hooks**

React to heartbeat runs via `heartbeat` on the `Mastra` constructor. It's a single hook bundle that runs for every agent's heartbeats; each hook receives the firing `agentId` so you can branch on it. `prepare` resolves fire-time parameters (for example, creating a fresh thread per fire), and `onFinish` / `onError` / `onAbort` mirror `agent.stream`.

```ts
new Mastra({
  // ...
  heartbeat: {
    // Return overrides, `null` to skip this fire, or `undefined` to use defaults.
    prepare: async ({ agentId, heartbeat }) => {
      if (agentId === 'chef' && heartbeat.name === 'daily-digest') {
        return { threadId: await createDailyThread(), resourceId: 'slack:U095PUH0FKL' };
      }
    },
    onFinish: ({ agentId, outcome, result, heartbeat }) => {
      metrics.record({ agentId, heartbeat: heartbeat.name, outcome });
    },
    onError: ({ agentId, error, phase, heartbeat }) => {
      alerts.send(`heartbeat ${agentId}/${heartbeat.name} failed in ${phase}: ${error.message}`);
    },
  },
});
```
