---
'@mastra/core': patch
---

Agents make fewer storage reads per message. The internal workflows an agent runs for every message (stream preparation, input and output processors) are never stored, so they no longer read their cancel status from storage at start and between steps. Your own workflow runs skip these reads too when they don't store an initial snapshot and you create them without a `runId`. Runs created with your own `runId`, and runs that have stored a snapshot, still pick up a cancel issued from another process.
