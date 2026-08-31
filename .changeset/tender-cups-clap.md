---
'@mastra/client-js': minor
---

Added `listVersionLabels`, `setVersionLabel`, `deleteVersionLabel`, production activation preconditions, and label selectors for agent reads and new executions. Selector transport now covers direct agent runs, tools, voice, Responses, A2A, networks, and AgentController turns. Client-tool continuations carry their source run ID, while streaming and non-streaming recursive turns reuse exact overrides and opaque rootless-continuation tokens returned by the server instead of resolving a moved label.

```ts
await client.getStoredAgent('agent-id').setVersionLabel('candidate', { versionId, expectedRevisionToken: null });
await client.getStoredAgent('agent-id').activateVersion({
  versionId,
  expectedActiveVersionId: previousVersionId,
});
```
