---
'@mastra/clickhouse': patch
---

Downgrade ClickHouse replication check on pre-existing local tables from an unrecoverable error to a warning log, allowing storage initialization to proceed while leaving existing local tables untouched.

