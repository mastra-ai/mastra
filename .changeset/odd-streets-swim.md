---
'@mastra/core': patch
---

Fixed a cancelled durable agent run starting anyway.

Cancelling a run that had not started yet, for example a turn still queued behind the thread's active run, had no effect: the run began when its turn came and streamed a full reply after the user had already stopped it. It now ends immediately instead, and `onAbort` fires. Resuming a run that was cancelled the same way behaves the same, and `onAbort` passed to `resume()` now reaches the caller.

```ts
agent.abortRunStream(runId);
// later, once the queue drains:
const { output } = await agent.stream('...', { runId });
// before: the run streamed a full reply
// after: the run ends right away and onAbort fires
```

Cancelling a durable agent run that is already executing now works through the agent APIs too. `agent.abortThreadStream({ resourceId, threadId })` and `agent.abortRunStream(runId)` only ever reached the abort controller a regular run prepares, which a durable run does not have, so they recorded a cancellation nothing acted on while the run streamed on. The server route `POST /agents/:agentId/threads/abort` goes through the same call. Both now publish the durable abort request as well, the same one the `abort()` on a stream result publishes, so the run stops in whichever process is executing it.

`agent.abortRunStream(runId)` also reports the outcome accurately now. It used to return `false` whenever the run had not started yet, even though the cancellation was recorded and honored. It now returns `true` when the cancellation reaches the run: it is executing, or it is queued in this Mastra instance and reads the cancellation the moment it starts. It returns `false` only for a run id this instance has never seen, which may belong to a run executing in another process.
