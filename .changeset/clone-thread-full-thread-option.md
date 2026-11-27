---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `options.fullThread` to the clone-thread endpoint. Send `fullThread: true` to copy every message of a thread whose observational memory would otherwise limit the clone to the messages still in the context window.

```ts
await client.getMemoryThread({ threadId: 'thread-123', agentId: 'my-agent' }).clone({
  options: { fullThread: true },
});
```
