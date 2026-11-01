---
'@mastra/core': patch
---

`ifIdle.streamOptions.runId` is now honoured when `sendSignal`, `sendMessage`, `queueSignal` or `queueMessage` starts a new run. Previously the runtime always generated a random id. The caller's id now appears in `accepted.runId`, `output.runId` and thread events, both when an idle thread wakes and when the run is queued behind the active one. If the requested id already names a known run, `accepted` rejects. Calls that omit it behave as before.

```ts
const { accepted } = agent.sendSignal(
  { type: 'user-message', contents: 'hello' },
  { resourceId, threadId, ifIdle: { streamOptions: { runId: 'my-run-id' } } },
);
await accepted; // { action: 'wake', runId: 'my-run-id', output }
```
