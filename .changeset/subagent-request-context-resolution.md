---
'@mastra/core': patch
'@mastra/code-sdk': patch
---

Subagent model IDs now resolve with the calling run's request context, so custom providers and tenant credentials work for subagents the same way they do for the main agent.

`AgentControllerConfig` accepts an optional `resolveSubagentModel(modelId, { requestContext })` hook for request-aware subagent model resolution.

```ts
const controller = new AgentController({
  // ...
  resolveSubagentModel: (modelId, { requestContext }) => resolveTenantModel(modelId, requestContext),
});
```
