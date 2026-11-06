---
'@mastra/core': patch
---

Agents make fewer storage reads per message.

The internal workflows an agent runs for every message (stream preparation, input and output processors) are never stored. They no longer read their cancel status from storage at start and between steps.

Your own workflow runs skip these reads too, but only when both are true:

- the workflow's `shouldPersistSnapshot` returns `false` for every run status
- you create the run without a `runId`

Every other run still picks up a cancel issued from another process. That includes a run whose `createRun({ shouldPersistSnapshot })` skips the snapshot while the workflow's own policy stores some status, and a run that has stored a snapshot.
