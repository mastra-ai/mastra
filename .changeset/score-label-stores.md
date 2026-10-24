---
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/oracledb': patch
'@mastra/dsql': patch
'@mastra/spanner': patch
'@mastra/dynamodb': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare-d1': patch
'@mastra/lance': patch
'@mastra/libsql': patch
---

Added the optional `label` column to the scores table so categorical scorer results are stored and read back. Existing tables get the column automatically on startup.
