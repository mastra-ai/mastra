---
'@mastra/client-js': minor
---

Added `listVersionLabels`, `setVersionLabel`, `deleteVersionLabel`, and label selectors for agent reads and new executions.

```ts
await client.getStoredAgent('agent-id').setVersionLabel('candidate', { versionId, expectedRevisionToken: null });
```
