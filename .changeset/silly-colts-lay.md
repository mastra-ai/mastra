---
'@mastra/core': patch
---

Fixed evented workflows running a step again, or ending a run twice, when their events arrive late or more than once (#28712). This covers a broker redelivery, a message that waited in a queue while `restart()` recovered the run, and a worker that stopped right after a step finished.

- A step's result is saved before the run moves on, so a late event for the step continues from that result or is ignored instead of running the step again. A run whose instance stopped between two steps continues once the step's event is delivered again.
- A run ends once: a duplicate end no longer ends the run a second time, for a success or a failure, and a nested workflow's result reaches its parent once, so a parent `dountil` or `dowhile` checks its condition once per iteration, also when the parent is restarted.
- When `shouldPersistSnapshot` declines the final snapshot, a late event for the finished run no longer runs its last step again, and a late copy of its start no longer runs the run again. Reusing the run ID for a new run still works.
- `restart()` no longer erases steps the run saved after `restart()` read it. When the run moved on in the meantime, the restart is dropped and the run goes on from what it saved.
- A step that keeps failing still stops after its configured retries when its worker crashes between attempts and the run is restarted.
- A late event that has used up its delivery attempts no longer fails the run.

Some cases keep the earlier behavior:

- Foreach items and suspended results are saved when their end is handled, not before. A worker that stops in between can still run them again.
- A step id used at more than one place in a workflow keeps the earlier behavior for a late continuation of the step before it.
- The run is read again right before it ends and before a restart writes it, but not in the same storage call as the write. A write landing in the few milliseconds between the two can still end a run twice or be overwritten by a restart.
- A worker that stops after saving a run's final status and before publishing its end leaves the run finished in storage, and a redelivery doesn't publish that end.

This needs a storage adapter with run-ownership support. Workflows with `autoRestartActiveRuns: false`, including durable agent workflows, are unchanged.

If an evented workflow sets `pruneSnapshot`, keep each step result's `status`, `startedAt` and `endedAt`, a loop step's `metadata.iterationCount`, a foreach step's `suspendPayload.__workflow_meta.foreachOutput`, and the snapshot's `activePaths`. Without them, a late event can run its step a second time.
