---
'@mastra/playground-ui': minor
---

Added `McpAppViewer` component for rendering interactive MCP Apps in Studio. Uses the standard `@mcp-ui/client` `AppRenderer` for sandboxed iframe rendering with full JSON-RPC postMessage protocol. Supports tool input hydration, interactive tool calls (`callServerTool`), and `sendMessage` for injecting messages into the chat from the app UI.
