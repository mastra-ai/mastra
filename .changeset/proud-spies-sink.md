---
'@mastra/core': minor
---

Added pending agent signals to the memory storage domain for storage adapter authors. A memory store that sets `supportsPendingSignals` keeps a signal sent to a thread as a row of its messages table under reserved thread IDs until a run of the thread saves it with the run's messages, and the row then becomes a normal message of the thread. A transient signal is never saved: its row is deleted when the run that took it ends. `pendingQueueThreadId`, `takenQueueThreadId`, `isQueueThreadId` and `assertNotQueueThreadId` from `@mastra/core/storage` build and check those IDs; adapters reject thread IDs that start with `QUEUE_THREAD_PREFIX`. The in-memory store supports it. Other adapters are unchanged, and the new methods throw on them. These methods and flags are experimental, and their contract may change in a minor release.

```ts
import { isTransientSignalMessage } from '@mastra/core/agent';

const memory = await storage.getStore('memory');
if (memory?.supportsPendingSignals) {
  await memory.setSignalRun({ threadId, runId });
  await memory.enqueuePendingSignal({ message: signal.toDBMessage({ threadId, resourceId }), toRunId: runId });
  const signals = await memory.claimPendingSignals({ threadId, runId, consumedIds: [] });
  // The run saves the signals it delivered with its messages, except transient ones; the save moves each row into the thread.
  await memory.saveMessages({ messages: signals.filter(s => !isTransientSignalMessage(s)) });
  // The close deletes the consumed rows still taken, here the transient signals.
  await memory.closeSignalRun({ threadId, runId, consumedIds: signals.map(s => s.id) });
}
```

`pendingSignalsSharedAcrossProcesses` tells whether every process of a deployment sees the same rows; it is false for the in-memory store.
