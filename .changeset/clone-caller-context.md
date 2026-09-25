---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed thread cloning and subagent forks losing the signed-in user when memory is configured as a function. The caller's request context now reaches the memory factory, so per-user memory and credentials resolve correctly instead of failing with a missing user context.

Pass the caller's context when cloning a thread:

```ts
await session.thread.clone({ sourceThreadId, requestContext });
```
