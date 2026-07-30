---
'@mastra/core': minor
---

Add optional `idleTimeoutMs` and `isAlive` options to `DurableAgent.observe()`.

When the process running a durable agent stops unexpectedly, the run stops producing updates but never emits a completion event — so a client that reconnects with `observe()` previously waited forever, with no way to tell the run was gone. With `idleTimeoutMs` set, the observed stream ends after that many milliseconds of silence. An optional `isAlive` check is consulted first: if it reports the run is still being worked on (for example a long-running tool call, or a run paused waiting for human input), the stream keeps waiting instead of ending. Fully backward-compatible — with neither option set, `observe()` behaves exactly as before.

```ts
// Reconnect to an in-flight run, but stop waiting if the run is no longer running.
const { output } = await agent.observe(runId, {
  idleTimeoutMs: 30_000,
  // Consulted only after idleTimeoutMs of silence. Return true while the run is
  // still being worked on to keep waiting; false (or omitted) ends the stream.
  isAlive: () => runHeartbeat.isFresh(runId),
});

// Omit both options for the previous behavior (wait indefinitely):
const { output: legacy } = await agent.observe(runId);
```
