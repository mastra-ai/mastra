---
'@mastra/clickhouse': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Fixed duplicate spans migration issue. When upgrading from older versions, existing duplicate (traceId, spanId) combinations in the spans table could prevent the unique constraint from being created. The migration now automatically deduplicates spans before adding the constraint, keeping the most complete and recent record. Fixes #11840
