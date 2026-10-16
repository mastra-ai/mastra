---
'@mastra/libsql': minor
---

Added durable agent version labels to LibSQL, with transactional conditional updates, restart-safe pointers, and protection against deleting labeled versions.

Given a configured LibSQL store and an existing agent version:

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

Use the returned revision token when moving an existing label to detect stale writes. Upgrade all processes that write the same store before relying on label retention.
