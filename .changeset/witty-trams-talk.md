---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added the experimental `getTasksInfo()` and `getTasksInspector()` methods to MCP servers, so tools like Studio can see which tools run as MCP tasks and list, cancel or answer a server's tasks.
