---
'@mastra/core': minor
---

Made the workspace optional when creating an agent controller session. Previously `createSession()` threw `A session requires a valid workspace instance` unless a workspace was configured, which blocked chat-style sessions that only need threads, state, and agent runs.

```ts
// Now works — no workspace configured anywhere
const controller = new AgentController({ id: 'chat', storage, modes });
const session = await controller.createSession({ resourceId: 'user-1' });

session.getWorkspace(); // undefined
```

`Session.getWorkspace()` now returns `Workspace | undefined`, so check the result before using it. Passing a value that is not a `Workspace` instance is still rejected. Sessions that do configure a workspace are unchanged, including workspace initialization and the `workspace_ready` / `workspace_error` events.

Closes #20594
