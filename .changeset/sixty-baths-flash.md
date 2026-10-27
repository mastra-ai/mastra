---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

MCP server pages in Studio now show which tools run as MCP tasks (experimental) and list the server's recent tasks with their status, open input requests and expiry. Opening a task shows its result or error, and lets you cancel it or answer an elicitation it is waiting on.
