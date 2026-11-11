---
'@mastra/core': patch
---

Fixed evented workflows running a step again when its event arrives after the step finished, such as a broker redelivery or a message that waited in a queue while `restart()` ran the step (#28712). The instance that receives the event now continues the run from the step's saved result, or drops the event when the run already moved past the step. A run whose instance stopped after saving a step's result, before the next step started, continues the same way when the step's event is delivered again, also when that delivery has used up its attempts. A late event for a step the run already moved past is dropped and no longer fails the run when it has used up its delivery attempts. Workflows with `autoRestartActiveRuns: false` behave as before.

A `pruneSnapshot` hook on an evented workflow must keep each step result's `status`, `startedAt` and `endedAt`. The instance compares them with the result the event carries to tell a finished step from one that still has to run.
