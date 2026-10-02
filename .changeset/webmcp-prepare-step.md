---
"@mastra/agent-browser": minor
---

AgentBrowser can now expose WebMCP page tools as first-class agent tools instead of forcing agents through the `browser_webmcp` meta-tool. Two new helpers plug into Mastra's `prepareStep` extension point:

- `browser.createWebMcpPrepareStep(opts?)` — returns a `prepareStep` function to pass to `agent.generate` / `agent.stream`. The agent sees `page_<tool_name>` tools alongside its usual `browser_*` tools and can call them in one step.
- `browser.getPageWebMcpTools(opts?)` — lower-level helper that returns a `Record<string, Tool>` of the current page's WebMCP tools without wiring them into `prepareStep`.

```typescript
await agent.generate("Add 2 of sku-9 to the cart", {
  prepareStep: browser.createWebMcpPrepareStep(),
})
```

Each returned `prepareStep` function instance memoizes the lookup by current page URL, so repeat steps on the same page emit the same tool-list bytes. Prompt caches are prefix-based and a changing tool list invalidates everything from the tool list on, so navigation (not every step) is what busts the cache.

Options:

- `prefix` — id prefix applied to each page tool (default `page_`); pass `''` to drop it entirely. Collisions with existing tool ids drop the page tool.
- `threadId` — pin to a specific thread; defaults to the browser's current thread.
- `passthrough` — chain an existing `prepareStep` whose result is merged with the page tools.

Keep one of the two patterns. When using `prepareStep`, hide the meta-tool with `excludeTools: [BROWSER_TOOLS.WEBMCP]` so the agent only sees one way to call page tools.
