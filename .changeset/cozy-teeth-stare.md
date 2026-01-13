---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Changed JSON columns from TEXT to JSONB in `mastra_threads` and `mastra_workflow_snapshot` tables.

**Why this change?**

These were the last remaining columns storing JSON as TEXT. This change aligns them with other tables that already use JSONB, enabling native JSON operators and improved performance. See [#8978](https://github.com/mastra-ai/mastra/issues/8978) for details.

**Columns Changed:**
- `mastra_threads.metadata` - Thread metadata
- `mastra_workflow_snapshot.snapshot` - Workflow run state

## PostgreSQL

**Migration Required** - PostgreSQL enforces column types, so existing tables must be migrated.

*Option 1: Use the helper methods (recommended)*
```typescript
const store = new PostgresStore({ id: 'my-store', connectionString: '...' });
await store.init();

// Migrate threads metadata
await store.migrateThreadsMetadataToJsonb();

// Migrate workflow snapshots
await store.migrateWorkflowSnapshotToJsonb();
```

*Option 2: Run SQL directly*
```sql
ALTER TABLE mastra_threads
ALTER COLUMN metadata TYPE jsonb
USING metadata::jsonb;

ALTER TABLE mastra_workflow_snapshot
ALTER COLUMN snapshot TYPE jsonb
USING snapshot::jsonb;
```

## LibSQL

**No Migration Required** - LibSQL now uses native SQLite JSONB format (added in SQLite 3.45) for ~3x performance improvement on JSON operations. The changes are fully backwards compatible:

- Existing TEXT JSON data continues to work
- New data is stored in binary JSONB format
- Both formats can coexist in the same table
- All JSON functions (`json_extract`, etc.) work on both formats

New installations automatically use JSONB. Existing applications continue to work without any changes.
