---
'@mastra/platform': minor
---

`PlatformKnowledge` no longer needs `instanceId`: without one it finds your project's Knowledge instance on first use, from a project token or `projectId`/`MASTRA_PROJECT_ID`. Its default `id` is now `platform-knowledge` (was random per boot) and its storage id is `platform-knowledge` (was `platform-knowledge-<instanceId>`).
