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

`agent.abortRunStream(runId)` also reports the outcome accurately now. It used to return `false` whenever the run had not started yet, even though the cancellation was recorded and honored. It now returns `true` when the run is one this Mastra instance knows about (running, or queued and about to start), and `false` only for a run id it has never seen, which may belong to a run executing in another process. Those are still cancelled with `agent.abortThreadStream({ resourceId, threadId })`.
