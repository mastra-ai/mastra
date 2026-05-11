---
'@mastra/core': minor
---

Added `listRootSpanJsonKeys` and `listLogJsonKeys` to the observability storage interface for discovering the distinct top-level keys found on root-span `metadata`/`attributes` and log `metadata`/`data`. The default implementations scan up to 250 recent records portably; storage backends can override with native SQL distinct-keys extraction for speed.

```ts
const storage = mastra.getStorage();
const { keys } = await storage.listRootSpanJsonKeys({ field: 'metadata' });
// keys: ['organizationId', 'tenantId', 'userId', ...]
```
