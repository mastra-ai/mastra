---
'@mastra/server': patch
---

Added API routes for stored MCP clients and tool provider discovery.

**Stored MCP Client Routes**

New REST endpoints for managing stored MCP client configurations:
- `GET /api/stored-mcp-clients` — List all stored MCP clients
- `GET /api/stored-mcp-clients/:id` — Get a specific MCP client
- `PUT /api/stored-mcp-clients/:id` — Create or update an MCP client
- `DELETE /api/stored-mcp-clients/:id` — Delete an MCP client

**Tool Provider Routes**

New REST endpoints for browsing registered tool providers:
- `GET /api/tool-providers` — List all registered tool providers with metadata
- `GET /api/tool-providers/:id` — Get a specific tool provider's details

Updated stored agent schemas to include `mcpClients` and `integrationTools` conditional fields, and updated agent version tracking accordingly.
