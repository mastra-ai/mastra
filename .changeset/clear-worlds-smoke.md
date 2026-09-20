---
'@mastra/factory': minor
'@mastra/mcp-docs-server': patch
'@mastra/client-js': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/connect': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Knowledge importers now sync into every Factory project automatically: destination scopes are resolved from the live project inventory on each run, so new projects start receiving Notion, Confluence, Jira, Linear, Zendesk, and Fireflies content without a restart. Also exported factoryProjectScopes for hosts that configure importers themselves.
