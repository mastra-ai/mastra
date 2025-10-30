---
'@mastra/longmemeval': major
'@mastra/cloudflare-d1': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/memory': major
'@mastra/server': major
'@mastra/dynamodb': major
'@mastra/mongodb': major
'@mastra/upstash': major
'@mastra/core': major
'@mastra/libsql': major
'@mastra/lance': major
'@mastra/mssql': major
'@mastra/pg': major
---

Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses offset/limit pagination instead of page/perPage and adds support for orderBy and sortDirection parameters.
