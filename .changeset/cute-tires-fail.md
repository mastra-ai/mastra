---
'@mastra/core': minor
---

Fixed signals sent to a running evented agent not reaching the run when its steps execute in another process. Evented agents with memory now keep these signals in the messages table of their memory storage on Postgres, LibSQL and the in-memory store, so a message or steer sent while the run is working reaches the run's next model call. When every process shares the storage, as with Postgres or a LibSQL file or server, that holds when the call runs in another process. On the in-memory store, signals stay in one process. The run needs a thread and a `resourceId`. A signal the run never took becomes the thread's next turn. A transient signal of these runs waits as a row of the messages table under the reserved thread ID `mastra-queue:pending:<threadId>`, and under `mastra-queue:taken:<threadId>` once a run takes it, with no resource ID, until the run that takes it ends, and is then deleted; no message read by thread or resource returns it, and it is never saved as a message.

A run with `readOnly` memory, or a run started with `prepare()`, keeps its signals in the process that started it.

**`sendSignal` resolves `accepted` after the signal is stored**

For these agents, `accepted` resolves once the signal is saved, so a resolved `deliver` means the run will see it. A signal sent to a running run, or one that joined a run being woken, rejects `accepted` when it cannot be saved. A signal sent while a `stream()` call is starting its run waits in the sending process and is saved for the run when the run registers, before its first model call. If that save fails after `accepted` resolved, the signal stays in the sending process, and the end of that run saves it and starts the thread's next turn with it. If that save fails too, the signal waits in the sending process for the thread's next run in that process.

**`cancelQueuedMessages` now returns a promise**

`Agent.cancelQueuedMessages` now returns a promise, for every agent. It resolves with the IDs this process cancelled, including ones it deleted from memory storage when it knows the thread's store: this process started the thread's current run and that run hasn't ended, or the agent's memory is a fixed instance and this process knows the thread's run keeps its signals in storage. Other processes cancel matching input when they get the request, and those IDs are not in the result. A signal a run already took stays delivered. Code that reads its result without `await` has to add one.

Before:

```ts
const { cancelledSignalIds } = agent.cancelQueuedMessages({ resourceId, threadId, signalIds: [signal.id] });
```

After:

```ts
const { cancelledSignalIds } = await agent.cancelQueuedMessages({ resourceId, threadId, signalIds: [signal.id] });
```

A warning is logged once when the pubsub reaches other processes and an evented agent's signals stay in one process, with the reason: the run has no memory, thread or `resourceId`, the memory storage does not keep pending signals, or it keeps them in this process only.
