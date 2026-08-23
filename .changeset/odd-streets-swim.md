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

`agent.abortRunStream(runId)` also reports the outcome accurately now. It used to return `false` whenever the run had not started yet, even though the cancellation was recorded and honored. It now returns `true` when the cancellation is going to land on its own: the run is already running with a live abort controller, or it is queued in this Mastra instance and reads the cancellation the moment it starts. It returns `false` when the cancellation cannot land from here, for example a durable run that is already executing, or a run id this instance has never seen, which may belong to a run executing in another process. Stop those with `agent.abortThreadStream({ resourceId, threadId })` or the stream result's `abort()`.
