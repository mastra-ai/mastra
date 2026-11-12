---
'@mastra/core': patch
---

Fixed cancelled deferred tool calls still showing as running after a thread reloads. A cancelled call now keeps its placeholder result and is stored with `providerMetadata.mastra.backgroundTask.status: 'cancelled'`. Cancelling doesn't notify the agent. Tasks stopped by a shutdown are stored as before, so hosts can still show them as interrupted.
