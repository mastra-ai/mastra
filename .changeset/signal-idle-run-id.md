---
'@mastra/core': patch
---

Fixed signal-started runs to use the `ifIdle.streamOptions.runId` you provide. This applies when `sendSignal`, `sendMessage`, `queueSignal` or `queueMessage` wakes an idle thread or queues a run behind the active one. The id appears in `accepted.runId`, `output.runId` and thread events. If the id already names a known run, `accepted` rejects. Calls without an id still get a random one.

```ts
const { accepted } = agent.sendSignal(
  { type: 'user-message', contents: 'hello' },
  { resourceId, threadId, ifIdle: { streamOptions: { runId: 'my-run-id' } } },
);
await accepted; // { action: 'wake', runId: 'my-run-id', output }
```
