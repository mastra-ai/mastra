---
'@mastra/core': minor
---

**Added** `agent.setHeartbeat()` to schedule recurring agent activity on a cron, backed by a first-class `type: 'heartbeat'` schedule target.

Heartbeats let an agent run periodically — either inside an existing thread (via `agent.sendSignal()` so subscribers receive the message through the normal channel pipeline) or in isolation (via a one-off `agent.generate()`). They self-clean when the agent or thread is gone, and survive process restarts: any persisted heartbeat row automatically starts the scheduler on boot, with no per-process registration step.

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

Internally heartbeats now ride on a dedicated `HeartbeatWorker` consuming a
`heartbeats` pubsub topic, instead of a built-in workflow. The schedule
dispatcher (previously `WorkflowScheduler`, now `Scheduler`) generalises to
any target type and only knows about CAS, cron advancement, and topic
routing.

Heartbeat-driven runs are now marked end-to-end so subscribers can distinguish
them from user-driven runs and enforce per-heartbeat broadcast policy without
any extra processor wiring:

- `signal.providerOptions.mastra.heartbeat = { scheduleId, broadcast, threadId? }`
  is stamped on the heartbeat signal (threaded) and on the `agent.generate`
  run options (threadless). It rides onto the transient `data-${signalType}`
  chunk and onto persisted messages.
- The transient signal data chunk now also carries `runId`, so consumers can
  correlate the heartbeat marker with all subsequent chunks for that run.
- `AgentChannels.consumeAgentStream` applies broadcast policy per run: `live`
  passes everything through, `on-complete` buffers text deltas and flushes a
  single text part on finish, and `never` drops the run from the channel
  entirely. Tool execution is unaffected — the agent loop still sees every
  chunk.
- The default typing-status resolver maps any heartbeat signal chunk to
  `'is checking in…'`.
