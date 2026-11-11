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

Restarting active workflow runs at boot is faster when many runs are active (#28712). Before restarting runs, these adapters check whether another instance still owns them a batch at a time instead of reading each run separately. PostgreSQL, LibSQL, MySQL, MSSQL and MongoDB send one query per batch, DynamoDB one batch read per 100 runs and Upstash one pipeline request per 100 runs. Redis and Valkey still read each run with its own call, but send a batch's calls together.
