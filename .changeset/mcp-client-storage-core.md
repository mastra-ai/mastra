---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added MCP client storage domain and ToolProvider interface for integrating external tool catalogs with stored agents.

**MCP Client Storage**

New storage domain for persisting MCP client configurations with CRUD operations. Each MCP client can contain multiple servers with independent tool selection:

```ts
// Store an MCP client with multiple servers
await storage.mcpClients.create({
  id: 'my-mcp',
  name: 'My MCP Client',
  servers: {
    'github-server': { url: 'https://mcp.github.com/sse' },
    'slack-server': { url: 'https://mcp.slack.com/sse' },
  },
});
```

LibSQL, PostgreSQL, and MongoDB storage adapters all implement the new MCP client domain.

**ToolProvider Interface**

New `ToolProvider` interface at `@mastra/core/tool-provider` enables third-party tool catalog integration (e.g., Composio, Arcade AI):

```ts
import type { ToolProvider } from '@mastra/core/tool-provider';

// Providers implement: listToolkits(), listTools(), getToolSchema(), getTools()
```

`getTools()` receives `requestContext` from the current request, enabling per-user API keys and credentials in multi-tenant setups:

```ts
const tools = await provider.getTools(slugs, configs, {
  requestContext: { apiKey: 'user-specific-key', userId: 'tenant-123' },
});
```

**Tool Selection Semantics**

Both `mcpClients` and `integrationTools` on stored agents follow consistent three-state selection:
- `{ tools: undefined }` — provider registered, no tools selected
- `{ tools: {} }` — all tools from provider included
- `{ tools: { 'TOOL_SLUG': { description: '...' } } }` — specific tools with optional overrides
