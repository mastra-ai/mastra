---
'@mastra/mcp': patch
---

`MCPServer` now includes `_meta` on successful `tools/call` results when metadata is present. The tool's MCP Apps linkage (`_meta.ui.resourceUri`, plus the legacy flat `ui/resourceUri` key) is mirrored from `tools/list` so spec-compliant hosts can detect the app from the call result, and `_meta` returned by an MCP-aware tool alongside `structuredContent` is preserved (the author's UI linkage replaces the descriptor's and is normalized to both forms). Results with no metadata from either source are unchanged. Fixes #21277.
