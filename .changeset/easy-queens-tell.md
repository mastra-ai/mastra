---
'@mastra/client-js': minor
---

Added agent version-label management, conditional Production activation, and selectors for agent reads and execution, including tools, voice, networks, Responses, A2A, and AgentController.

```ts
const storedAgent = client.getStoredAgent('agent-id');
await storedAgent.setVersionLabel('candidate', {
  versionId: 'version-2',
  expectedRevisionToken: null,
});
await storedAgent.activateVersion({
  versionId: 'version-2',
  expectedActiveVersionId: 'version-1',
});
```

Client-tool continuations preserve the source run and the immutable versions selected by the server. Structured API errors retain their codes and details. Signal writes, conditional label mutations, and conditional activation requests are not automatically retried, avoiding accidental duplicate or stale writes.
