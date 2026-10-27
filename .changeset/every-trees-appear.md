---
'@mastra/server': minor
---

Added Studio routes to list a MCP server's tasks newest first (`GET /mcp/:serverId/tasks`, 50 per page by default, at most 200, filtered by `status`, `surface` or `client`, with a `nextCursor` for older tasks), find one by its MCP task id (`POST /mcp/:serverId/tasks/find`, id in the body), cancel one (`POST /mcp/:serverId/tasks/:taskKey/cancel`) and answer its input requests (`POST /mcp/:serverId/tasks/:taskKey/input`). Server list and detail responses include `tasks_capability` when a server runs tools as tasks. Sessions scoped to a resource get no task list, since MCP clients and Mastra resources are separate identities.
