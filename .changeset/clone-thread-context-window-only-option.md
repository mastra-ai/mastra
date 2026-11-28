---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `options.contextWindowOnly` to the clone-thread endpoint. Send `contextWindowOnly: true` to copy only the observations and the messages still in the context window of a thread with observational memory; without it the clone copies every message, as before. A body that combines `contextWindowOnly: true` with `messageFilter` or `messageLimit` gets a 400 `Invalid request body` response on `options.contextWindowOnly`, and nothing is cloned.

```ts
await client.getMemoryThread({ threadId: 'thread-123', agentId: 'my-agent' }).clone({
  options: { contextWindowOnly: true },
});
```
