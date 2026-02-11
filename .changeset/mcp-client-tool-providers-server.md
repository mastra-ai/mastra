---
'@mastra/server': patch
---

Added API routes for stored MCP clients and tool provider discovery.

**Stored MCP Client Routes**

New REST endpoints for managing stored MCP client configurations:
- `GET /api/stored-mcp-clients` — List all stored MCP clients
- `GET /api/stored-mcp-clients/:id` — Get a specific MCP client
- `POST /api/stored-mcp-clients` — Create a new MCP client
- `PATCH /api/stored-mcp-clients/:id` — Update an existing MCP client
- `DELETE /api/stored-mcp-clients/:id` — Delete an MCP client

```ts
// Create a stored MCP client
const response = await fetch('/api/stored-mcp-clients', {
  method: 'POST',
  body: JSON.stringify({
    id: 'my-mcp-client',
    name: 'My MCP Client',
    servers: {
      'github-server': { url: 'https://mcp.github.com/sse' },
    },
  }),
});
```

**Tool Provider Routes**

New REST endpoints for browsing registered tool providers and their tools:
- `GET /api/tool-providers` — List all registered tool providers with metadata
- `GET /api/tool-providers/:providerId/toolkits` — List toolkits for a provider
- `GET /api/tool-providers/:providerId/tools` — List tools (with optional toolkit/search filtering)
- `GET /api/tool-providers/:providerId/tools/:toolSlug/schema` — Get input schema for a tool

```ts
// List all registered tool providers
const providers = await fetch('/api/tool-providers');

// Browse tools in a specific toolkit
const tools = await fetch('/api/tool-providers/composio/tools?toolkit=github');

// Get schema for a specific tool
const schema = await fetch('/api/tool-providers/composio/tools/GITHUB_LIST_ISSUES/schema');
```

Updated stored agent schemas to include `mcpClients` and `integrationTools` conditional fields, and updated agent version tracking accordingly.
