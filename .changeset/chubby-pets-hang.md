---
'@mastra/mcp': patch
---

Fixed MCP Apps not opening in hosts that read the app link from a tool call result. `MCPServer` now returns a tool's `_meta.ui.resourceUri` (and the flat `ui/resourceUri` key for older hosts) on successful `tools/call` results, as it already does on `tools/list`. `getMcpCallToolMeta(result)` from Mastra's own client now returns the link. Fixes #21277.

Two related cases change with it:

- **Tools that declare two different links:** `tools/list` and `tools/call` now both report the nested `ui.resourceUri` under both keys, so hosts reading either key open the same app.
- **Tools that declare only the flat `ui/resourceUri` key:** the server now advertises the MCP Apps extension for them, as it does for the nested form.
