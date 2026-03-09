---
'@mastra/libsql': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
---

Fixed slow semantic recall in the libsql, Cloudflare D1, and ClickHouse storage adapters. Recall performance no longer degrades as threads grow larger. (Fixes #11702)
