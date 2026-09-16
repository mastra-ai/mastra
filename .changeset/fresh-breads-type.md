---
'@mastra/pg': minor
---

Added durable agent version labels to PostgreSQL with transactional conditional moves, restart-safe pointers, and labeled-version deletion protection.

Resolve explicit labels and version IDs against the primary database so replica lag cannot select an outdated target or report a valid version as missing. Ordinary reads continue to use configured read replicas.

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
