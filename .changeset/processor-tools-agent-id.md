---
'@mastra/core': patch
---

Fixed tools returned by an input processor's `processInputStep` (such as `ToolSearchProcessor`'s loaded tools) running with an empty `context.agent.agentId`. They now receive the agent's id, the same as tools assigned to the agent directly, in both regular and durable agents.
