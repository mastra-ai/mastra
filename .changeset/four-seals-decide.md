---
'@mastra/core': minor
---

Added `resolveWorkspaceById` hook for lazy workspace resolution.

Dynamic workspaces (e.g. factory sessions with IDs like `mfw-<repoId>-<sessionId>-web-factory`) previously only lived in the in-memory registry that was populated as a side effect of the request that first spawned them. On container restart or a fresh replica, later lookups for the same id would 404 with `MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND` even though the underlying sandbox was still reachable.

The new `Mastra` config accepts a `resolveWorkspaceById(id, { mastra })` hook. A new async `Mastra.resolveWorkspaceById(id)` method consults the in-memory registry first, and on a miss invokes the hook, registers the returned workspace (`source: 'resolver'`), and returns it. Concurrent lookups for the same id share one in-flight resolution.

The sync `getWorkspaceById` is unchanged (still throws on a miss), so existing callers are not affected.

```typescript
new Mastra({
  resolveWorkspaceById: async (id, { mastra }) => {
    const session = await sessions.findByWorkspaceId(id);
    if (!session) return undefined;
    return createFactoryWorkspace(session, { mastra });
  },
});

// Callers use the new async method to opt into lazy resolution:
const workspace = await mastra.resolveWorkspaceById('mfw-abc-xyz-web-factory');
```
