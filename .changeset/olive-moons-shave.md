---
'@mastra/mcp': patch
---

Fixed `MCPServer` omitting `_meta` on `tools/call` results, which meant MCP Apps only rendered in Mastra Studio. A tool's declared `_meta` — including `ui.resourceUri` in both its nested and legacy flat form — is now returned on the call result, matching what `tools/list` already advertises, so any spec-compliant MCP host can resolve the app. `_meta` returned by a tool's `execute()` is also carried through and takes precedence over the declared metadata, except where an `outputSchema` strips it from the result first.
