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

Recovering stopped workflow runs (`restartAllActiveWorkflowRuns()`) is faster when many runs are active (#28712). These adapters check whether runs are still owned by another instance a batch at a time instead of reading each run separately. PostgreSQL, LibSQL, MySQL, MSSQL and MongoDB send one query per batch, DynamoDB one batch read per 100 runs and Upstash one pipeline request per 100 runs. Redis and Valkey still read each run with its own call, but send a batch's calls together.
