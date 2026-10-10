---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed MCP App tools not being detectable by AI SDK UI hosts. For tools whose MCP server exposes an app UI (`mcp._meta.ui.resourceUri`), `toAISdkStream` now sets `toolMetadata.app` (`resourceUri`, `mimeType: 'text/html;profile=mcp-app'`, and `serverId` when available) on `tool-input-start` and `tool-input-available` chunks, so hosts can render MCP Apps without a custom stream transform. Fixes #25892.
