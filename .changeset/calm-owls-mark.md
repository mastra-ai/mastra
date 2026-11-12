---
'@mastra/core': patch
---

Fixed a deleted stored agent's workspace showing up again.

An async workspace factory can finish after its stored agent is deleted. The late workspace used to look like a code agent's, so servers showed it. Servers can now keep it hidden.

Agent workspace entries in `mastra.listWorkspaces()` have a new `agentSource` field. It records the source of the agent that registered the workspace: `'code'`, `'stored'` or `'fs'`.

```ts
const entry = mastra.listWorkspaces()[workspaceId];
if (entry.source === 'agent' && entry.agentSource === 'stored') {
  // registered by a stored agent
}
```
