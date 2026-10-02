---
"@mastra/agent-browser": minor
---

AgentBrowser now surfaces WebMCP page tools as first-class agent tools via a single `prepareStep` function. Pass `browser.prepareStep` to `agent.generate` / `agent.stream` and page tools arrive as `page_<tool_name>` tools alongside the usual `browser_*` tools.

```typescript
const browser = new AgentBrowser({ webmcp: { enabled: true } })

await agent.generate('Add 2 of sku-9 to the cart', {
  prepareStep: browser.prepareStep,
})
```

Two discovery modes on `webmcp.toolDiscovery`:

- `'auto'` (default): every tool the current page exposes is merged into the toolset each step. The agent can call `page_<tool>` immediately after `browser_goto` resolves.
- `'manual'`: adds a `browser_webmcp_discover` tool. The agent calls it (optionally with `names: [...]` to limit the attach set) and the attached tools appear on the next step. Useful when the page offers many tools but the agent only needs a few.

Each step the tool list is memoized by current page URL inside `browser.prepareStep`, so repeat steps on the same page emit the same tool-list bytes. Prompt caches are prefix-based: a changing tool list invalidates everything from that point, so navigation is what busts the cache, not every step.

Additional `webmcp` options:

- `toolPrefix` — override the default `page_` id prefix (pass `''` to drop it). Base `browser_*` tools win on collision.
- `allowedOrigins` — restrict which page origins can expose callable tools. Omit for any origin.
- `protocols` — restrict which WebMCP surfaces the bridge installs (`'mcpb'`, `'w3c'`). Omit for all.
