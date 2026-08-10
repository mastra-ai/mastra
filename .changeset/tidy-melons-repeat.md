---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/oracledb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/memory': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/lance': patch
'@mastra/redis': patch
'@mastra/core': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Fixed generated thread titles being clobbered during a turn

`updateThread` required both `title` and `metadata`, so callers that only needed to
change metadata (message persistence, working memory, observational memory, channel
subscriptions) had to read the thread and pass its title back. When title generation
finished between that read and the write, the freshly generated title was overwritten
with the stale one.

`title` and `metadata` are now independently optional: omitting one leaves that column
untouched. Callers that only change metadata no longer send a title, and message
persistence no longer rewrites a thread row it just read.
