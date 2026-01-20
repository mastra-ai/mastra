---
'@mastra/clickhouse': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Fixed duplicate spans migration issue across all storage backends. When upgrading from older versions, existing duplicate (traceId, spanId) combinations in the spans table could prevent the unique constraint from being created. The migration deduplicates spans before adding the constraint.

**Deduplication rules (in priority order):**

1. Keep completed spans (those with `endedAt` set) over incomplete spans
2. Among spans with the same completion status, keep the one with the newest `updatedAt`
3. Use `createdAt` as the final tiebreaker

**What changed:**

- Added `migrateSpans()` method to observability stores for manual migration
- Added `checkSpansMigrationStatus()` method to check if migration is needed
- PostgreSQL and MSSQL use batched processing (1000 rows per batch) to avoid memory issues on large tables
- ClickHouse, LibSQL, and MongoDB perform single-query migrations

**Usage example:**

```typescript
const observability = await storage.getStore('observability');
const status = await observability.checkSpansMigrationStatus();
if (status.needsMigration) {
  const result = await observability.migrateSpans();
  console.log(`Migration complete: ${result.duplicatesRemoved} duplicates removed`);
}
```

Fixes #11840
