---
'@mastra/pg': minor
---

Added durable agent version labels to PostgreSQL, including VNext, with transactional conditional updates, restart-safe pointers, and protection against deleting labeled versions.

Given a configured PostgreSQL store and an existing agent version:

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

Strict label and exact-version selection reads from the primary database so replica lag cannot select an outdated target. Ordinary reads continue to use configured read replicas. Upgrade all processes that write the same store before relying on label retention.
