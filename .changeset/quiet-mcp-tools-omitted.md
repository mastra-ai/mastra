---
'@mastra/core': patch
'@mastra/client-js': patch
---

Fixed the `StorageMCPClientToolsConfig` and `StoredMCPClientToolsConfig` JSDoc. It previously said that omitting `tools` includes all MCP tools. For an agent-level MCP client reference, omitting `tools` selects no tools. Use `tools: {}` to include all tools.
