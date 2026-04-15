---
'@mastra/server': patch
'@mastra/client-js': patch
---

Add `/api/background-tasks` routes (SSE stream, list with filters + pagination, get by ID) and matching `MastraClient` methods (`listBackgroundTasks`, `getBackgroundTask`, `streamBackgroundTasks`).
