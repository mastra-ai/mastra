---
'@mastra/cloudflare-d1': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/dynamodb': major
'@mastra/mongodb': major
'@mastra/upstash': major
'@mastra/core': major
'@mastra/libsql': major
'@mastra/lance': major
'@mastra/mssql': major
'@mastra/pg': major
---

Remove `getMessagesById` method from storage interfaces in favor of `listMessagesById`. The new method only returns V2-format messages and removes the format parameter, simplifying the API surface. Users should migrate from `getMessagesById({ messageIds, format })` to `listMessagesById({ messageIds })`.
