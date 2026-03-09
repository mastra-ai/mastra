---
'@mastra/upstash': patch
'@mastra/clickhouse': patch
'@mastra/convex': patch
'@mastra/lance': patch
'@mastra/cloudflare': patch
---

Fixed semantic recall latency by skipping unnecessary full thread loads, COUNT queries, and data queries when only included messages are needed (perPage=0 path used by semantic recall). Previously, all thread messages were fetched and paginated in memory even when only the include results were needed. (Fixes #11702)
