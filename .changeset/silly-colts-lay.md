---
'@mastra/core': patch
---

Fixed evented workflows running a step again, or ending a run twice, when their events arrive late or more than once (#28712). This covers a broker redelivery, a message that waited in a queue while `restart()` recovered the run, and a worker that stopped right after a step finished.

- A step's result is saved before the run moves on, so a late event for the step continues from that result or is ignored instead of running the step again. A run whose instance stopped between two steps continues once the step's event is delivered again.
- A run ends once: a duplicate end publishes no second finish event, and a nested workflow's result reaches its parent once, so a parent `dountil` or `dowhile` checks its condition once per iteration.
- When `shouldPersistSnapshot` declines the final snapshot, a late event for the finished run no longer runs its last step again. Reusing the run ID for a new run still works.
- `restart()` no longer erases steps the run saved after `restart()` read it. When the run moved on in the meantime, the restart is dropped and the run goes on from what it saved.
- A step that keeps failing still stops after its configured retries when its worker crashes between attempts and the run is restarted. On PostgreSQL, the restart still starts the attempts over.
- A late event that has used up its delivery attempts no longer fails the run.

The run is read again right before it ends and before a restart writes it, but not in the same storage call as the write. A write landing in the few milliseconds between the two can still end a run twice or be overwritten by a restart.

This needs a storage adapter with run-ownership support. Workflows with `autoRestartActiveRuns: false`, including durable agent workflows, are unchanged. The stale-restart check needs a store that updates a run's `updatedAt` on every write, which the in-memory store doesn't do for step results.

If an evented workflow sets `pruneSnapshot`, keep each step result's `status`, `startedAt` and `endedAt`, a loop step's `metadata.iterationCount`, a foreach step's `suspendPayload.__workflow_meta.foreachOutput`, and the snapshot's `activePaths`. Without them, a late event can run its step a second time.
