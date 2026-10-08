---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

`toAISdkStream` now sets `toolMetadata.app` (`resourceUri`, `serverId`, `mimeType: 'text/html;profile=mcp-app'`) on `tool-input-start` and `tool-input-available` chunks for MCP App tools, so AI SDK UI hosts can render MCP Apps without a custom stream transform. Fixes #25892.
