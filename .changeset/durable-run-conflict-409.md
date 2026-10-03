---
'@mastra/server': patch
'@mastra/client-js': patch
---

Durable agent requests that conflict with a run's state now return `409 Conflict` instead of `500`. This covers recovering a run that another execution still drives, that is already being recovered, or that is suspended, and starting a run that another execution holds.

Observing a durable agent run no longer streams events from an execution that lost the run to recovery.
