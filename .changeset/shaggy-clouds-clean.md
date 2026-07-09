---
'@mastra/mcp': minor
---

Fixed MCP server notifications (resource updates, resource/prompt list changes) not reaching clients connected over streamable HTTP. Notifications are now broadcast to every connected session across all transports.

Added support for the remaining MCP notification features:

**Dynamic tools and tools/list_changed**

Servers can now add and remove tools at runtime and notify clients via `notifications/tools/list_changed`:

```typescript
// Server: manage tools at runtime
await server.toolActions.add({ myNewTool });
await server.toolActions.remove(['myNewTool']);
await server.toolActions.notifyListChanged();

// Client: react to tool list changes
await mcp.tools.onListChanged('myServer', async () => {
  const tools = await mcp.listTools();
});
```

**Server-side log messages**

Servers can now emit `notifications/message` log notifications. The minimum level a client sets via `logging/setLevel` is honored per session:

```typescript
// Broadcast to all connected clients
await server.sendLoggingMessage({ level: 'info', data: { message: 'Sync completed' } });

// From inside a tool, send to the calling client
await context.mcp.log('debug', 'Fetching weather', { location });
```

**Progress notifications from tools**

Tools can now report progress to the calling client:

```typescript
await context.mcp.progress({ progress: 1, total: 3, message: 'step 1' });
```
