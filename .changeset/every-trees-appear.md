---
'@mastra/server': minor
---

Added Studio routes to list a MCP server's most recent tasks (`GET /mcp/:serverId/tasks`, 50 by default, at most 200), cancel one (`POST /mcp/:serverId/tasks/:taskKey/cancel`) and answer its input requests (`POST /mcp/:serverId/tasks/:taskKey/input`). Server list and detail responses include `tasks_capability` when a server runs tools as tasks. Sessions scoped to a resource get no task list, since MCP clients and Mastra resources are separate identities.
