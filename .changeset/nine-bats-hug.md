---
'@mastra/mcp': minor
---

MCPClient.listTools(), listToolsets() and listToolDefinitions() no longer hand agents the tools an MCP App server marks as app-only (`_meta.ui.visibility: ['app']`). Those tools are meant to be called by the server's app UI, not by the model, so agents no longer see helpers such as data relays in their tool list, including agents rebuilt with `toolsFromDefinitions()` from a catalog cached before this change. `onServerSettled` callbacks receive the same filtered tools.

If your code called an app-only tool through `MCPClient`, call it from the app instead. The app asks its host to run the tool (`tools/call`), and the host forwards the call to the MCP server.

```ts
// Before: app-only tools were in the agent's tool list
const tools = await mcp.listTools()
await tools.dashboard_observabilityMetricAggregate.execute(input, context)

// After: listTools() no longer returns them; the app calls the tool through its host
```
