---
'@mastra/core': patch
---

Fixed evented workflows running a step again, or ending a run twice, when their events arrive late or more than once (#28712). This covers a broker redelivery, a message that waited in a queue while `restart()` recovered the run, and a worker that stopped right after a step finished.

- A step's result is saved before the run moves on, so a late event for the step continues from that result or is ignored instead of running the step again. A run whose instance stopped between two steps continues once the step's event is delivered again.
- A run ends once, after a success or a failure, even when its end arrives twice. A nested workflow's result reaches its parent once, so a parent `dountil` or `dowhile` checks its condition once per iteration, also after a restart.
- When `shouldPersistSnapshot` declines the final snapshot, a late event for the finished run no longer runs its last step again, and a late copy of its start no longer runs the run again. Reusing the run ID for a new run still works.
- `restart()` no longer erases steps the run saved after `restart()` read it. When the run moved on in the meantime, the restart is dropped and the run goes on from what it saved.
- A step that keeps failing still stops after its configured retries when its worker crashes between attempts and the run is restarted.
- A late event that has used up its delivery attempts no longer fails the run.

Some cases keep the earlier behavior:

- Foreach items and suspended results are saved when their end is handled, not before. A worker that stops in between can still run them again.
- When a workflow uses the same step at more than one place, a late event for the step before a later use can still run that later use again.
- The run is read again right before a restart writes it, but not in the same storage call as the write. A step saved in the few milliseconds between the two can still be overwritten by the restart.
- A run is marked ended once its end is reported. Two ends handled at the same moment, or a worker that stops between reporting the end and marking the run, can report the run's end a second time.

This needs a storage adapter with run-ownership support. Workflows with `autoRestartActiveRuns: false`, including durable agent workflows, are unchanged.

If an evented workflow sets `pruneSnapshot`, keep each step result's `status`, `startedAt` and `endedAt`, a loop step's `metadata.iterationCount`, a foreach step's `suspendPayload.__workflow_meta.foreachOutput`, and the snapshot's `activePaths`. Without them, a late event can run its step a second time.
