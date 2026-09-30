---
'@mastra/client-js': minor
---

Added `thread.archive()` and `thread.unarchive()`, and an `archived` option on `listMemoryThreads()`.

```ts
await mastraClient.getMemoryThread({ threadId: 'thread-123', agentId: 'agent-1' }).archive();
const active = await mastraClient.listMemoryThreads({ resourceId: 'user-123', archived: false });
```
