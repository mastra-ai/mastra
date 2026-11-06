---
'@mastra/core': patch
---

Agents make fewer storage reads per message.

The internal workflows an agent runs for every message (stream preparation, input and output processors) are never stored. They no longer read their cancel status from storage at start and between steps.

Your own workflow runs skip these reads too, but only when both are true:

- the workflow's `shouldPersistSnapshot` doesn't store the initial snapshot
- you create the run without a `runId`

Every other run still picks up a cancel issued from another process. That includes a run whose `createRun({ shouldPersistSnapshot })` skips the snapshot while the workflow's own policy stores it, and a run that has stored a snapshot.
