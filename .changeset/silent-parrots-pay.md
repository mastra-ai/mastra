---
'@mastra/core': patch
---

Added public read-only thread query methods on `AgentController` and a `initStorage()` method that initializes storage without provisioning a workspace. Use these to read threads or messages without paying the workspace/sandbox startup cost that `createSession` incurs.

```ts
// Before: had to create a session (which called Workspace.init() -> sandbox.start())
const session = await controller.createSession({ resourceId });
const threads = await session.thread.list();

// After: read directly from storage, no session, no workspace
const threads = await controller.queryThreads({ resourceId });
const messages = await controller.queryThreadMessages({ threadId, limit: 50 });
const thread = await controller.queryThreadById({ threadId });
```

`queryThreads`, `queryThreadById`, and `queryThreadMessages` were already used internally; they are now part of the public `AgentController` API. Each lazily calls `initStorage()`, so callers don't need to pre-init.
