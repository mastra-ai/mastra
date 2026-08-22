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
