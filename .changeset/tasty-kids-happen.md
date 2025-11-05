---
'@mastra/playground-ui': major
'@mastra/client-js': major
'@mastra/cloudflare-d1': major
'@mastra/ai-sdk': major
'@mastra/react': minor
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/deployer-cloud': major
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

Renamed `MastraMessageV2` to `MastraDBMessage`
Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function
