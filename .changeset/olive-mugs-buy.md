---
'@mastra/core': minor
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added metadata filtering support for `listMessages` and `listMessagesByResourceId`. You can now filter messages by metadata key-value pairs using the `filter.metadata` option. All specified key-value pairs must match (AND logic). Supported value types are string, number, boolean, and null. See #12260 for details.
