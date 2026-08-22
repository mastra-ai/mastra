---
'@mastra/mcp': patch
---

Return tool `_meta` on `tools/call` results in `MCPServer`

MCP Apps hosts resolve which app to render from the `_meta.ui.resourceUri` on a tool-call result, but `MCPServer` only emitted `_meta` from `tools/list`. As a result MCP Apps rendered in Mastra Studio but not in third-party hosts following the `@modelcontextprotocol/ext-apps` spec, and any `_meta` a tool returned from its own `execute()` was silently dropped.

Tool-call results now carry `_meta`, emitting both the canonical nested `ui.resourceUri` and its legacy flat alias exactly as `tools/list` does. `_meta` returned by `execute()` is preserved and merged over the statically declared tool metadata, with the `ui` namespace merged key by key so sibling keys such as `ui.visibility` are not lost.
