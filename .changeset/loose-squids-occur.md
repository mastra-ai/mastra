---
'@mastra/deployer': patch
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server)

Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`
