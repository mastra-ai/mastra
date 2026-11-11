---
'@mastra/core': patch
---

Fixed a deleted stored agent's workspace looking like a code agent's once it was registered again. Registered agent workspaces now record the `agentSource` of the agent that registered them (`mastra.listWorkspaces()[id].agentSource`), so servers can keep a deleted stored agent's workspace hidden even when an async workspace factory resolves after the delete.
