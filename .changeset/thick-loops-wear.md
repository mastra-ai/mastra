---
'@mastra/mcp': minor
'@mastra/core': patch
---

Added native multimodal tool-result support. MCP tools now automatically convert image and audio content from MCP `CallToolResult` responses into model-native media output, and core agent execution can auto-detect MCP-like multimodal `content` arrays from regular tools without requiring explicit `toModelOutput` configuration.
