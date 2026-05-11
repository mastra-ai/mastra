---
'@mastra/core': minor
---

Added `listRootSpanJsonKeys` and `listLogJsonKeys` so developers can discover the distinct top-level JSON keys present on root-span `metadata`/`attributes` and log `metadata`/`data` — useful for building autocomplete pickers and any UI that needs to enumerate what custom fields a project stores. A portable default scans recent records; backends can optionally provide faster native implementations.

```ts
const storage = mastra.getStorage();
const { keys } = await storage.listRootSpanJsonKeys({ field: 'metadata' });
// keys: ['organizationId', 'tenantId', 'userId', ...]
```
