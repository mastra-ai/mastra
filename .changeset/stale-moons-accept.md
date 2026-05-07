---
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

Added MASTRA_STUDIO_THREADS_LIST_RESOURCE_SCOPED env var. Set to `false` to show threads created from any resource (e.g. via Slack or other channels) in the Studio thread list. Defaults to `true` (current behavior — only threads where resourceId matches the agentId are shown).
