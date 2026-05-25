---
'@mastra/core': minor
---

**Added** `agent.setHeartbeat()` to schedule recurring agent activity on a cron, built on top of scheduled workflows.

Heartbeats let an agent run periodically — either inside an existing thread (via `agent.sendSignal()` so subscribers receive the message through the normal channel pipeline) or in isolation (via a one-off `agent.generate()`). They self-clean when the agent or thread is gone.

```ts
// Threaded heartbeat: signals the thread on a cron.
await agent.setHeartbeat({
  threadId,
  resourceId,
  cron: '*/5 * * * *',
  signal: 'Check in on the user',
  ifActive: 'discard', // skip while a turn is running
  ifIdle: 'wake', // start a new run when idle
});

// Threadless heartbeat: runs the agent on a cron with no thread.
await agent.setHeartbeat({
  cron: '0 * * * *',
  prompt: 'Run the hourly summary tool',
});

await agent.getHeartbeat(threadId);
await agent.listHeartbeats();
await agent.clearHeartbeat(threadId);
```
