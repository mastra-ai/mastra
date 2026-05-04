---
'@mastra/server': minor
---

Added API endpoints for MCP server resources, enabling clients to list and read app resources for interactive UI rendering.

- `GET /api/mcp/:serverId/resources` — lists available resources on an MCP server
- `POST /api/mcp/:serverId/resources/read` — reads a specific resource by URI (e.g. `ui://calculator/app`)
