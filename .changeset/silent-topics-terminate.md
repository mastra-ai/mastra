---
'@mastra/core': minor
---

Add optional `idleTimeoutMs` and `isAlive` options to `DurableAgent.observe()`. A durable run whose driving process crashed stops emitting chunks but never publishes a terminal event, so a reconnecting `observe()` previously hung forever on a producerless pubsub topic. With `idleTimeoutMs` set, the stream terminates after that much silence; an optional `isAlive` probe (e.g. a run-liveness heartbeat) is consulted first so a legitimately-idle-but-live run (a long tool call, or a suspended HITL gate) keeps waiting instead of being closed. Fully backward-compatible: absent, behavior is unchanged.

```ts
// Reconnect to an in-flight run, but don't hang forever if the pod driving it died.
const { output } = await agent.observe(runId, {
  idleTimeoutMs: 30_000,
  // Consulted only when the stream has been silent for idleTimeoutMs. Return true
  // while a producer is still driving the run (a heartbeat, a suspended HITL gate)
  // to keep waiting; false/absent terminates the stream with an error chunk.
  isAlive: () => runHeartbeat.isFresh(runId),
});

// Omit both options for the previous unbounded behavior:
const { output: legacy } = await agent.observe(runId);
```
