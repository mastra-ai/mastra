---
"@mastra/agent-browser": minor
---

Add WebMCP support (beta): AgentBrowser can discover and call tools that pages expose through WebMCP. The feature is opt-in — pass `webmcp: { enabled: true }` and AgentBrowser injects an in-page bridge before any page script runs and adds a `browser_webmcp` tool with two actions.

Both supported protocols are auto-detected per page:

- **W3C `navigator.modelContext`** (`'w3c'`): the bridge installs a polyfill with the draft's semantics (duplicate registrations throw, call arguments are validated against the declared `inputSchema`) and mirrors registrations into a native implementation when the browser ships one.
- **MCP-B Tab transport** (`'mcpb'`): for pages running an in-page MCP server (`McpServer` + `TabServerTransport` from `@mcp-b/transports`), the bridge connects as a real MCP client over `window.postMessage` — handshake, `initialize`, `tools/list`, `tools/call`.

```typescript
import { AgentBrowser } from '@mastra/agent-browser'

// Opt in, listening for all protocols.
const browser = new AgentBrowser({ webmcp: { enabled: true } })

// Restrict protocols or origins.
new AgentBrowser({
  webmcp: {
    enabled: true,
    protocols: ['mcpb'], // 'mcpb' | 'w3c'; omit to listen for all
    allowedOrigins: ['https://shop.example.com'],
  },
})
```

The agent uses `action: "list"` to see what the current page exposes and `action: "call"` with `{ toolName, args }` to invoke one. Pages that use neither surface are unaffected.
