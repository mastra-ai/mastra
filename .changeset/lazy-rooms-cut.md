---
'@mastra/core': minor
---

Added `agentId` to the agent tool execution context. Tools executed by an agent can now access `context.agent.agentId` to identify which agent is calling them. This enables tools to look up agent metadata, share workspace configuration with sub-agents, or customize behavior per agent.
