---
'@mastra/libsql': patch
'@mastra/cloudflare-d1': patch
'@mastra/mssql': patch
---

Fixed semantic recall latency that scaled linearly with message count. Rewrote \_getIncludedMessages() to batch-fetch target message metadata and use cursor-based pagination instead of ROW_NUMBER window functions, enabling index usage. Also skips unnecessary COUNT(\*) and data queries when only included messages are needed (perPage=0 path used by semantic recall). (Fixes #11702)
