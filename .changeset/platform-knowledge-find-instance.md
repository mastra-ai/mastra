---
'@mastra/platform': minor
---

`PlatformKnowledge` no longer needs `instanceId`: without one it finds your project's Knowledge instance on first use, from a project token or `projectId`/`MASTRA_PROJECT_ID`.
