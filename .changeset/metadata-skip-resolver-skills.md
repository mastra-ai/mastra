---
'@mastra/core': patch
'@mastra/server': patch
---

Agent metadata routes (`GET /api/agents` and `GET /api/agents/:agentId`) no longer call a workspace filesystem resolver to list skills. Skills read through a filesystem resolver are still found when the agent runs. `agent.listSkills()` accepts `resolveDynamicProviders: false` to skip them.
