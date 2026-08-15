---
'@mastra/clickhouse': patch
---

Fixed ClickHouse replication initialization rejecting pre-existing tables that use local engines. Initialization now warns that `CREATE TABLE IF NOT EXISTS` will leave those tables unchanged and continues creating any missing replicated tables.
