---
'@mastra/mcp': minor
---

Added a `legacy` option to `MCPServer` that serves MCP clients that still open with `initialize` (2025-era clients such as VS Code and Cursor) over HTTP.

```ts
const server = new MCPServer({
  name: 'My server',
  version: '1.0.0',
  tools,
  legacy: 'stateless',
});
```

Each request from these clients is answered without a session. `GET` and `DELETE` session requests get `405`, and features that need MCP 2026-07-28 (suspend/resume, `subscriptions/listen`, events) aren't available to them. The default stays `'reject'`, which answers these clients with an unsupported-protocol-version error.
