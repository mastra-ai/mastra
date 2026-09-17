---
'@mastra/turso': minor
---

Added durable agent version labels to `TursoStore` through its LibSQL implementation, with conditional updates, restart-safe pointers, and protection against deleting labeled versions.

Given a configured Turso store and an existing agent version:

```ts
const agents = await storage.getStore('agents');
if (!agents?.versionLabels) throw new Error('Version labels are unavailable');

await agents.versionLabels.set({
  entityType: 'agent',
  entityId: 'agent-id',
  label: 'candidate',
  versionId: 'version-2',
  expectedRevisionToken: null, // Use the current revisionToken when moving a label.
});
const selected = await agents.getByIdResolved('agent-id', { label: 'candidate' });
```

Use matching feature-enabled core and LibSQL packages, and upgrade all processes that write the same store before relying on label retention.
