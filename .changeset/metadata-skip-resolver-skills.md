---
'@mastra/core': minor
'@mastra/server': minor
---

Agent metadata routes (`GET /api/agents` and `GET /api/agents/:agentId`) no longer call a workspace filesystem resolver to list skills. Skills read through a filesystem resolver are still found when the agent runs. `agent.listSkills()` accepts `resolveDynamicProviders: false` to skip them.

```ts
// Lists agent-level skills and skills from a static filesystem or skillSource without calling the filesystem resolver
const skills = await agent.listSkills({ requestContext, resolveDynamicProviders: false });
```
