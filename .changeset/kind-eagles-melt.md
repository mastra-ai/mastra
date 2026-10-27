---
'@mastra/mcp': minor
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
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

**MCP tasks in Studio**

MCP servers with `tasks` enabled now report which tools run as tasks (`always` or `auto`, and whether they recover after a restart), and give Studio an admin view to list recent tasks and cancel or answer them. Cancelling or answering from Studio goes through the same path as the protocol's `tasks/cancel` and `tasks/update`. The view only shows hashed task and client keys, never raw task ids or client identities. Custom task stores can opt in by implementing `MCPTaskStoreAdmin` (`list`, `updateByKey`, `cancelByKey`); stores without it are reported as not listable.

The MCP client now writes an `mcp-task` progress entry (`MCPTaskProgress`) to a tool's output stream when its call continues as an MCP task and whenever the task's status changes, so UIs can show the remote task id and status while it runs.
