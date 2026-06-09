---
"@mastra/core": minor
---

Add workspace registry cleanup and shutdown destruction.

Mastra now exposes `removeWorkspace(id, { destroy })` for removing runtime workspaces from the registry. When `destroy` is true, the workspace is destroyed before removal and remains registered if destruction fails.

`mastra.shutdown()` now destroys registered workspaces before closing storage and unregisters only the workspaces that clean up successfully. Workspace tool execution also updates `lastAccessedAt`, so runtime activity is tracked beyond search operations.

```ts
await mastra.removeWorkspace('workspace-123', { destroy: true }); // destroys, then unregisters
await mastra.removeWorkspace('workspace-456'); // unregisters only; caller owns destroy
await mastra.shutdown(); // destroys registered workspaces, then closes storage
```
