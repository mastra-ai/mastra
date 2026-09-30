---
'@mastra/server': minor
'@mastra/mcp-docs-server': patch
'@mastra/client-js': patch
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/connect': patch
'@mastra/memory': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added a `GET /agents/:agentId/avatar` route that streams stored avatar bytes from `mastra.getAvatarStore()` with the recorded mime type. Extended avatar validation to accept `mastra-avatar:<agentId>` references and absolute `http(s)://` URLs alongside the existing `data:` scheme. Stored-agent `GET` and `LIST` responses now rewrite `mastra-avatar:` values into the resolvable route URL so existing UIs render them as normal `<img src>` without changes.
