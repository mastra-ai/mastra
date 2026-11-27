---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed background tasks losing non-object results: a string, number or boolean written to result, error, suspendPayload or metadata now reads back exactly as written instead of being rejected or turned into an object. Scalar JSON values are encoded and decoded consistently in Postgres, MySQL, MSSQL, Cloudflare D1, Cloudflare, Lance and DynamoDB. Fixes #31613
