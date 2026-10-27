---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added Studio routes to list a MCP server's tasks (`GET /mcp/:serverId/tasks`), cancel one (`POST /mcp/:serverId/tasks/:taskKey/cancel`) and answer its input requests (`POST /mcp/:serverId/tasks/:taskKey/input`). Server list and detail responses include `tasks_capability` when a server runs tools as tasks. Sessions scoped to a resource get no task list, since MCP clients and Mastra resources are separate identities.
