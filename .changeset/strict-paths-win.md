---
'@mastra/core': minor
---

Fixed agent controller sessions creating an empty thread when no matching thread existed. `createSession()` now binds to the most recent matching thread, or leaves the session without a thread until it is needed. Sending a message or signal creates the thread on demand, so a session that is opened and closed without use no longer leaves an empty thread in storage. Passing an exact `threadId` still creates that thread immediately.

Added `session.thread.ensureId()`, which returns the current thread ID and creates a thread first if the session has none. Concurrent calls share one thread.

If your code reads the thread ID right after creating a session, use `ensureId()`. `requireId()` throws until a thread exists.

```ts
// Before
const session = await controller.createSession({ resourceId });
const threadId = session.thread.requireId();

// After
const session = await controller.createSession({ resourceId });
const threadId = await session.thread.ensureId();
```
