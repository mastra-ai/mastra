---
'@mastra/clickhouse': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Fixed duplicate spans migration issue across all storage backends. When upgrading from older versions, existing duplicate (traceId, spanId) combinations in the spans table could prevent the unique constraint from being created. The migration now automatically deduplicates spans before adding the constraint, keeping the most complete and recent record.

**What changed:**

- Added `migrateSpans()` method to observability stores for manual migration
- Added `checkSpansMigrationStatus()` method to check if migration is needed
- Migration deduplicates existing spans by keeping the most complete record (based on endTime and attributes)
- Uses batched processing to avoid memory issues on large tables
- Works across PostgreSQL, ClickHouse, LibSQL, MongoDB, and MSSQL

Fixes #11840
