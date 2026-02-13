---
'@mastra/client-js': patch
---

Added client SDK resources for stored MCP clients and tool providers.

**Stored MCP Client Resource**

New `StoredMCPClient` resource class with methods for managing MCP client configurations:

```ts
const client = new MastraClient({ baseUrl: '...' });

// CRUD operations
const mcpClients = await client.storedMCPClient.list();
const mcpClient = await client.storedMCPClient.get('my-mcp');
await client.storedMCPClient.create('my-mcp', { name: 'My MCP', servers: { ... } });
await client.storedMCPClient.delete('my-mcp');
```

**Tool Provider Resource**

New `ToolProvider` resource class for browsing registered tool providers:

```ts
const providers = await client.listToolProviders();
const provider = await client.getToolProvider('composio');
```

Updated agent types to include `mcpClients` and `integrationTools` conditional fields.
