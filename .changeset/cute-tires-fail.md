---
'@mastra/core': minor
---

Fixed signals sent to a running evented agent not reaching the run when its steps execute in another process. On storage that keeps agent signals (Postgres, LibSQL and the in-memory store), a message or steer sent while the run is working now reaches the run's next model call, wherever that call runs.

**`sendSignal` resolves `accepted` after the signal is stored**

For evented agents on storage that keeps agent signals, `accepted` now resolves once the signal is saved, so a resolved `deliver` means the run will see it. `accepted` rejects when the signal cannot be saved.

**`cancelQueuedMessages` can finish asynchronously**

For evented agents on storage that keeps agent signals, including a single process on the in-memory store, the cancellation completes in storage. `cancelledSignalIds` can then be empty, and the cancelled ids arrive on the new `settled` promise. A signal the run already took is not cancelled.

Before:

```ts
const { cancelledSignalIds } = agent.cancelQueuedMessages({ resourceId, threadId, signalIds: [signal.id] });
```

After:

```ts
const result = agent.cancelQueuedMessages({ resourceId, threadId, signalIds: [signal.id] });
const { cancelledSignalIds } = (await result.settled) ?? result;
```

A warning is logged once when the pubsub reaches other processes and the storage does not keep agent signals for every process.
