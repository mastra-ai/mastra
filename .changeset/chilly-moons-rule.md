---
'@mastra/libsql': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
---

Fixed slow semantic recall on large threads in the libsql, Cloudflare D1, and ClickHouse memory stores. Query performance no longer degrades linearly with thread size. (Fixes #11702)
