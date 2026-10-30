---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/inngest': patch
---

Fixed `POST /agents/:agentId/runs/:runId/abort` answering `{ aborted: false }` when it reached a server that does not own the run. The run stopped, but the client kept retrying for 10 seconds and then reported that cancellation was not acknowledged. The route now waits up to 2 seconds for the server executing the run to confirm the abort, and answers `{ aborted: true }` once it does. A run whose owner has gone still answers `{ aborted: false }` after that wait.
