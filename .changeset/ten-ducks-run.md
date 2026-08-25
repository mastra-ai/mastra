---
'@mastra/core': patch
---

Cancelling a durable agent run that is already executing now works through the agent APIs. `agent.abortThreadStream({ resourceId, threadId })` and `agent.abortRunStream(runId)` only ever reached the abort controller a regular run prepares, which a durable run does not have, so they recorded a cancellation nothing acted on while the run streamed on. The server route `POST /agents/:agentId/threads/abort` goes through the same call. Both now publish the durable abort request as well, the same one the `abort()` on a stream result publishes, so the run stops in whichever process is executing it.

```ts
const { runId } = await durableAgent.stream('...', { memory: { thread, resource } });

// before: the cancellation was recorded and the run streamed on to completion
// after: the run stops and onAbort fires
durableAgent.abortRunStream(runId);
```
