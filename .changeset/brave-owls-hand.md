---
'@mastra/core': minor
---

`session.thread.transferOwnership` now accepts an optional `threadId`, so you can transfer a thread without switching the session to it first. Without `threadId` it still transfers the active thread.

```ts
await session.thread.transferOwnership({ toOwnerId: 'user-456', threadId: 'thread-123' });
```
