---
'@mastra/mcp': minor
'@mastra/core': patch
---

Added automatic multimodal content support for MCP tool results. MCP tools that return images or audio (e.g., screenshot tools, CUA MCP server) now automatically convert their content to the model-native format without requiring explicit `toModelOutput` configuration.
