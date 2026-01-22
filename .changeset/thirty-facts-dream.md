---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/playground-ui': minor
'@mastra/client-js': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/libsql': patch
---

Added tool provider integrations (Composio, Arcade, Smithery, MCP) with OAuth support and dynamic tool management UI.

**New Features:**

- **Tool Provider Integrations**: Connect to external tool providers including Composio (500+ apps), Arcade, Smithery MCP registry, and custom MCP servers
- **OAuth Authentication**: Built-in OAuth flows for Composio and Arcade with popup authorization and status polling
- **MCP Protocol Support**: Full support for Model Context Protocol with both HTTP/SSE and Stdio transports
- **Smithery Registry**: Browse and connect to MCP servers from the Smithery registry with OAuth authentication
- **Integration Management UI**: Complete CRUD interface for managing tool integrations with add/edit/delete operations
- **Tool Selection**: Browse provider toolkits, search tools, and selectively enable/disable individual tools
- **Tool Caching**: Provider tools are cached in storage for fast agent access without repeated API calls
- **Tool Execution Proxy**: Server-side tool execution routing to provider APIs with credential management

**Usage Example:**

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/store-libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ url: 'file:local.db' }),
});

// Tool integrations are managed via the Mastra Studio UI
// Navigate to Tools page → Add Integration → Select Provider
// Tools are automatically available to agents based on integration configuration
```

**API Endpoints:**

- `GET /api/integrations/providers` - List available providers with connection status
- `POST /api/integrations` - Create integration with toolkit/server selection
- `GET /api/integrations/:id/tools` - List cached tools for an integration
- `POST /api/integrations/:id/refresh-tools` - Refresh tools from provider
- `POST /api/integrations/composio/auth/authorize` - Start Composio OAuth flow
- `POST /api/integrations/arcade/auth/authorize` - Start Arcade OAuth flow
- `POST /api/integrations/mcp/validate` - Validate MCP server connection
- `GET /api/integrations/smithery/servers` - Search Smithery MCP registry

**Storage Schema:**

Two new tables added for integration persistence:

- `integrations` - Stores provider configs, OAuth tokens, and connection details
- `cached_tools` - Caches tool definitions from providers for fast access
