---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed agent controller sessions losing the signed-in user when memory is configured as a function. Cloning a thread, forking a subagent, and opening a thread's history subscription (opening a session, switching or creating a thread, sending a message or notification, resuming a suspended tool) now pass the caller's request context to the memory factory. Per-user memory now resolves correctly instead of failing with a missing user context.

Pass the caller's context when cloning, switching, or creating a thread:

```ts
await session.thread.clone({ sourceThreadId, requestContext });
await session.thread.switch({ threadId, requestContext });
await session.thread.create({ title, requestContext });
```
