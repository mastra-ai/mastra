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

Sped up the boot-time restart of workflow runs when many runs are active. Whether each run is still owned by another instance is now read with one request per page of runs instead of one request per run (#28712).
