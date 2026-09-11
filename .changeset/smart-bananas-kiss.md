---
'@mastra/core': minor
---

Added `agent.listPendingSignals()` and `agent.removePendingSignals()` to inspect and cancel queued signal delivery for an agent and thread.

```ts
const pending = agent.listPendingSignals({ resourceId, threadId });
const { removedSignalIds } = agent.removePendingSignals({
  resourceId,
  threadId,
  signalIds: pending.slice(0, 2).map(entry => entry.signal.id),
});
```

Entries are returned in delivery order and tagged with their queue:

- `pre-run`: Joins a run that hasn't started yet.
- `pending`: Delivered as a follow-up turn.
- `idle`: Starts its own run once the thread is free.

Queue access and snapshots follow these rules:

- Access is scoped to the agent ID. Another agent's queued inputs aren't listed or removed.
- Listed entries are detached snapshots. Changing them doesn't alter queued delivery.
- Optional metadata or provider-options fields containing values that can't be cloned, such as functions, are omitted from snapshots. This includes per-part provider options. Queued signals remain unchanged.

Removal returns only IDs actually removed, in request order without duplicates. Missing and already-drained signals are skipped. Removal does not abort runs, retract acceptance, undo state updates, or change notification records. These methods only reflect the current process's in-memory queues.
