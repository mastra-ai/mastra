---
'@mastra/core': patch
---

Fixed evented workflows running a step again when its event arrives after the step finished, such as a broker redelivery or a message that waited in a queue while `restart()` ran the step (#28712). The instance that receives the event now continues the run from the step's saved result, or drops the event when the run already moved past the step. A run whose instance stopped after saving a step's result, before the next step started, continues the same way when the step's event is delivered again. A late event that has used up its delivery attempts no longer fails the run: it continues the run the same way, or is dropped when the run already moved past the step. Workflows with `autoRestartActiveRuns: false` behave as before.

A `pruneSnapshot` hook on an evented workflow must keep what tells a late event whether its step already finished: each step result's `status`, `startedAt` and `endedAt`, a loop body result's `metadata.iterationCount`, a foreach step result's per-item records in `suspendPayload.__workflow_meta.foreachOutput`, and the snapshot's `activePaths`.
