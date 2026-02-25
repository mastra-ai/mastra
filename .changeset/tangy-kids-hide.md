---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added source field to ServerInfo type to distinguish between code-defined and stored MCP servers. Made the status filter optional in MCP server storage list operations so all statuses are returned when no filter is specified.
