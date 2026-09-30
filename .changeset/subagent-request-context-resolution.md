---
'@mastra/core': minor
---

Added an optional `resolveSubagentModel(modelId, { requestContext })` option to `AgentControllerConfig`. Subagent models can now resolve with the calling run's request context, so custom providers and tenant credentials work for subagents the same way they do for the main agent. The context passed in doesn't include the parent run's thread or resource IDs.

```ts
const controller = new AgentController({
  // ...
  resolveSubagentModel: (modelId, { requestContext }) => resolveTenantModel(modelId, requestContext),
});
```
