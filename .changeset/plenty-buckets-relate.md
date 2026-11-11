---
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/libsql': patch
'@mastra/valkey': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/pg': patch
---

The boot-time workflow restart now checks whether a page of runs is still owned by another instance with one request instead of one request per run (#28712).
