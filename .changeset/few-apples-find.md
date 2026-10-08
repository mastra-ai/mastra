---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Tools from MCP servers that expose an MCP App UI (`mcp._meta.ui.resourceUri`) now include that pointer on their `tool-call` and `tool-call-input-streaming-start` stream chunks as `toolMetadata.app`, so UI hosts can detect MCP Apps.
