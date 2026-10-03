---
"@mastra/agent-browser": minor
---

Add WebMCP support (beta) to AgentBrowser: discover and call tools that pages expose through WebMCP, surfaced as first-class agent tools. The feature is opt-in — pass `webmcp: { enabled: true }` and AgentBrowser injects an in-page bridge before any page script runs. Attach the browser to an agent and page tools appear automatically, no `prepareStep` wiring required:

```typescript
import { Agent } from '@mastra/core/agent'
import { AgentBrowser } from '@mastra/agent-browser'

const browser = new AgentBrowser({ webmcp: { enabled: true } })

const agent = new Agent({
  name: 'shop',
  instructions: '…',
  model,
  browser,
})

await agent.generate('Add 2 of sku-9 to the cart') // page_<tool_name> tools appear each step
```

Both supported protocols are auto-detected per page:

- **W3C `navigator.modelContext`** (`'w3c'`): the bridge installs a polyfill with the draft's semantics (duplicate registrations throw, call arguments are validated against the declared `inputSchema`) and mirrors registrations into a native implementation when the browser ships one.
- **MCP-B Tab transport** (`'mcpb'`): for pages running an in-page MCP server (`McpServer` + `TabServerTransport` from `@mcp-b/transports`), the bridge connects as a real MCP client over `window.postMessage` — handshake, `initialize`, `tools/list`, `tools/call`.

Two discovery modes on `webmcp.toolDiscovery`:

- `'auto'` (default): every tool the current page exposes is merged into the toolset each step. The agent can call `page_<tool>` immediately after `browser_goto` resolves.
- `'manual'`: adds a `browser_webmcp_discover` tool. Agents call it (optionally with `names: [...]`) to pick which tools surface, useful when a page offers many tools but the agent only needs a few. After navigation agents discover again.

Prompt caches stay stable while the agent runs on the same page: repeat steps surface the same tool list, and concurrent runs on different threads don't interfere. Navigation (not every step) is what invalidates the cache.

Additional `webmcp` options:

- `protocols` — restrict which WebMCP surfaces the bridge listens for (`'mcpb'`, `'w3c'`). Omit for all.
- `allowedOrigins` — restrict which page origins can expose callable tools. Omit for any origin. Enforced with a re-check inside the in-page `evaluate` to close the TOCTOU window around mid-flight navigation.
- `toolPrefix` — override the default `page_` tool id prefix (pass `''` to drop it). Base `browser_*` tools win on collision.

For callers that don't use `new Agent({ browser })`, `browser.prepareStep` is also exposed as a stable property to wire manually.
