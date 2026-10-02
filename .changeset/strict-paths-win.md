---
'@mastra/core': minor
---

Added a `createSession()` option to start a session without creating a thread, and `session.thread.ensureId()` to create one on first use. Sessions that are never used no longer leave empty threads behind. Sending a message or signal creates the thread automatically. The default is unchanged: sessions still get a thread when none matches.

```ts
const session = await controller.createSession({ createInitialThread: false });

// Returns the current thread, or creates one. Concurrent calls share one thread.
const threadId = await session.thread.ensureId();
```
