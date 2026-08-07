---
'@mastra/mcp': minor
---

Added opt-in support for the stateless MCP protocol revision `2026-07-28` behind a `protocolVersion` flag on both `MCPServer` and the MCP client. Omitting the flag keeps today's behavior unchanged.

**Server**

```typescript
const server = new MCPServer({
  name: "My Server",
  version: "1.0.0",
  tools: { weatherTool },
  protocolVersion: "2026-07-28",
  cacheHints: {
    "tools/list": { ttlMs: 60_000, cacheScope: "private" },
  },
});
```

With the flag set:

- One HTTP endpoint serves both protocol eras: `2026-07-28` clients are served natively (stateless), and legacy clients are served through an automatic stateless fallback.
- `startStdio()` serves both eras, selecting the era from the connection's opening exchange.
- Tool, prompt, and resource change notifications also reach `2026-07-28` clients through `subscriptions/listen`.
- Tool log messages honor the caller's per-request `logLevel` opt-in.
- Optional `cacheHints` advertise `ttlMs` / `cacheScope` on cacheable results such as `tools/list`.

**Client**

```typescript
const mcp = new MCPClient({
  servers: {
    weather: {
      url: new URL("https://example.com/mcp"),
      protocolVersion: "auto", // probe, fall back to legacy
      // or '2026-07-28' to pin the revision and fail loudly when unavailable
    },
  },
});
```

Elicitation handlers currently only fire on legacy connections; support for the `2026-07-28` input-required mechanism ships separately.
