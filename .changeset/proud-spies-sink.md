---
'@mastra/core': minor
---

Added pending agent signals to the memory storage domain for storage adapter authors. A memory store that sets `supportsPendingSignals` keeps a signal sent to a thread as a hidden row of its messages table until a run claims it, and the row becomes a normal message once the run's messages are saved. The in-memory store supports it. Other adapters are unchanged, and the new methods throw on them.

```ts
const memory = await storage.getStore('memory');
if (memory?.supportsPendingSignals) {
  await memory.setSignalRun({ threadId, runId });
  await memory.enqueuePendingSignal({ message: signal.toDBMessage({ threadId, resourceId }), toRunId: runId });
  const signals = await memory.claimPendingSignals({ threadId, runId, consumedIds: [] });
  await memory.closeSignalRun({ threadId, runId, consumedIds: signals.map(s => s.id) });
}
```

`pendingSignalsSharedAcrossProcesses` tells whether every process of a deployment sees the same rows; it is false for the in-memory store.
