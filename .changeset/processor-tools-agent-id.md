---
'@mastra/core': patch
---

Tools added by an input processor (for example tools loaded through `ToolSearchProcessor`) now receive `context.agent.agentId` like tools assigned to the agent directly. Before, they ran with an empty `agentId`.
