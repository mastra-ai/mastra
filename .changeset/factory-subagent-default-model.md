---
'@mastra/core': patch
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Fixed subagents in Factory sessions ignoring the project's default model. Explore, plan, and execute subagents now use the Factory default model, and their model IDs resolve with the calling run's request context, so custom providers and tenant credentials work for subagents the same way they do for the main agent.

`AgentControllerConfig` accepts an optional `resolveSubagentModel(modelId, { requestContext })` hook for request-aware subagent model resolution.
