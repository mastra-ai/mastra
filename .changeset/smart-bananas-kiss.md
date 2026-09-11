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

Entries are returned in delivery order and tagged with their queue: `pre-run` (folded into a run that has not started yet), `pending` (delivered as a follow-up turn), or `idle` (starts its own run once the thread is free). Access is scoped to the agent ID: another agent's queued inputs are not listed or removed. Listed entries are detached snapshots, so changing them does not alter queued delivery. Optional metadata or provider-options fields containing values that cannot be cloned (such as functions) are omitted from snapshots, including per-part provider options; queued signals remain unchanged.

Removal returns only IDs actually removed, in request order without duplicates. Missing and already-drained signals are skipped. Removal does not abort runs, retract acceptance, undo state updates, or change notification records. These methods only reflect the current process's in-memory queues.
