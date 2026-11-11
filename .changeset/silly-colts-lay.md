---
'@mastra/core': patch
---

Fixed evented workflows running a step again when its event arrives after the step finished, for example a broker redelivery or a message that waited in a queue while `restart()` ran the step (#28712). The run now continues from the step's saved result, or ignores the event when the run is already past the step. A run whose instance stopped after a step finished but before the next step started also continues this way once the step's event is delivered again. A late event that has used up its delivery attempts no longer fails the run.

This needs a storage adapter with run-ownership support. Workflows with `autoRestartActiveRuns: false`, including durable agent workflows, are unchanged.

If an evented workflow sets `pruneSnapshot`, keep each step result's `status`, `startedAt` and `endedAt`, a loop step's `metadata.iterationCount`, a foreach step's `suspendPayload.__workflow_meta.foreachOutput`, and the snapshot's `activePaths`. Without them, a late event can run its step a second time.
