---
'@mastra/core': minor
---

Added a shared agent version-label storage contract with conditional moves, strict label resolution, and retention protection.

```ts
const agents = await storage.getStore('agents');
if (!agents?.versionLabels) throw new Error('Version labels are unavailable');

const pointer = await agents.versionLabels.set({
  entityType: 'agent',
  entityId: 'agent-id',
  label: 'staging',
  versionId: 'version-id',
  expectedRevisionToken: null,
});
const resolved = await agents.getByIdResolved('agent-id', { label: pointer.label });
```
