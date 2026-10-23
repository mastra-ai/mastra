---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed thread aborts for durable agents on multi-server deployments. Calling `POST /agents/:agentId/threads/abort` (or `agent.abortThreadStream({ resourceId, threadId })`) on a server that didn't start the run now stops the run on whichever server executes it, as aborting by run id already did. The server finds the run through the thread lease, so this needs a pubsub with a shared lease backend such as Redis or Valkey. The HTTP route reports `{ aborted: true }` once the run was asked to stop; the synchronous `abortThreadStream` still returns `false` for a run on another server because it can't wait for the lookup. An `expectedRunId` that doesn't match the running run still leaves it alone. `clearPendingSignals: true` clears the input queued on the server running the run before it stops, as long as that run still holds the thread; input queued for a run that has since taken over the thread is kept.
