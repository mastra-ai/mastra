---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed thread aborts for durable agents on multi-server deployments. Aborting a thread on a server that didn't start the run now stops the run on whichever server executes it, as aborting by run id already did.

```ts
agent.abortThreadStream({ resourceId, threadId });
// or POST /agents/:agentId/threads/abort
```

The server finds the run through the thread lease, so this needs a pubsub with a shared lease backend such as Redis or Valkey.

**Return values**

- The HTTP route returns `{ aborted: true }` once the abort request is published, and an error if the lease backend can't be reached or doesn't answer in time.
- The synchronous `abortThreadStream` still returns `false` for a run on another server, because it can't wait for the lookup.
- An `expectedRunId` that doesn't match the running run leaves it alone and returns `false`.

**Queued input**

With `clearPendingSignals: true`, the server running the run clears its queued input before stopping it, as long as that run still holds the thread. Input queued for a run that has since taken over the thread is kept.
