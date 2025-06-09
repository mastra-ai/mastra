---
'@mastra/mcp-docs-server': patch
'mastra': patch
---

Removed @latest from @mastra/mcp-docs-server scaffolded configuration for Windsurf/Cursor/VSCode. There is an npx caching issue that causes @latest to break the MCP server for many users, and for now removing @latest makes it work. We will debug this more but for now having a working docs server is more important than it updating every time users start their IDE.
