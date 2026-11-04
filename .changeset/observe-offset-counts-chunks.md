---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed agent stream resume sending duplicate chunks after a tool call. The `offset` passed to `POST /agents/:agentId/observe` and to `observe({ runId, offset })` in `@mastra/client-js` now means the number of chunks the client has already received, counting from the first chunk of `/stream` or of an `observe()` without an offset. Before, it counted internal log entries, which include step-boundary records that never reach the client, so a client resuming from the number of chunks it received got one repeated chunk for every finished step.

```ts
let received = 0;
const response = await client.getAgent('my-agent').stream(messages, { runId });
await response.processDataStream({ onChunk: () => void received++ });

// After a disconnect, resume exactly where the client left off
const resumed = await client.getAgent('my-agent').observe({ runId, offset: received });
```

If you passed an internal log index as `offset`, pass the number of chunks you received instead. Calls without `offset`, or with `offset: 0`, are unchanged. `DurableAgent.observe(runId, { offset })` in `@mastra/core` still takes a log index.
