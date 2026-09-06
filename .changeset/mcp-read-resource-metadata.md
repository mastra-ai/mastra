---
'@mastra/core': patch
'@mastra/mcp': patch
'@mastra/server': patch
---

Fixed `readResource()` dropping a resource's `mimeType` and `_meta`, which stripped MCP App `ui://` resources of their CSP settings before they reached the renderer. Native and proxied MCP servers now both return the same metadata their resource listing reports. Fixes #23068
