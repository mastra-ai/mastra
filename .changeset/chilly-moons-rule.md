---
'@mastra/libsql': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
---

Fixed slow semantic recall in the libsql, Cloudflare D1, and ClickHouse stores for threads with many messages. Query performance no longer degrades linearly with thread size. Also skips unnecessary queries when only semantic recall results are needed. (Fixes #11702)
