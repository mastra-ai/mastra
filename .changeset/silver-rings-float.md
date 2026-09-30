---
'@mastra/editor': minor
---

Added label-aware stored-agent resolution. Each lookup re-resolves movable labels; missing labels or exact versions fail instead of silently selecting a different version.

```ts
// Default stored-agent selection.
await editor.agent.getById('agent-id');

// Resolve an existing label to its current immutable agent version.
await editor.agent.getById('agent-id', { label: 'candidate' });
```

Versioned editor namespaces also reject combined selectors, such as `status` and `versionId`. Labels remain limited to agents.
