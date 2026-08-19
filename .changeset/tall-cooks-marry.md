---
'@mastra/core': patch
---

Improved Agent Controller session startup by initializing workspaces only when used.

Agent Controller no longer initializes configured workspaces during controller or session creation. Call `await session.getWorkspace()?.init()` explicitly if your application requires eager initialization. Workspace operations otherwise initialize their resources lazily.
