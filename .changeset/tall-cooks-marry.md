---
'@mastra/core': patch
---

Improved Agent Controller session startup by initializing workspaces only when used.

Agent Controller no longer initializes configured workspaces during controller or session creation.

Before, session creation implicitly initialized the configured workspace:

```ts
const session = await controller.createSession({ id: 'session-id' });
```

After, applications that require eager initialization must request it explicitly:

```ts
const session = await controller.createSession({ id: 'session-id' });
await session.getWorkspace()?.init();
```

Workspace operations otherwise initialize their resources lazily.
