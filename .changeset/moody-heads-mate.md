---
'@mastra/libsql': minor
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

Added durable agent version labels to LibSQL with atomic conditional moves, restart-safe pointers, and labeled-version deletion protection.

```ts
const agents = await storage.getStore('agents');
if (!agents?.versionLabels) throw new Error('Version labels are unavailable');

await agents.versionLabels.set({
  entityType: 'agent',
  entityId: 'agent-id',
  label: 'staging',
  versionId: 'version-id',
  expectedRevisionToken: null,
});
```
