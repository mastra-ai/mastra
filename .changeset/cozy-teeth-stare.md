---
'@mastra/core': minor
'@mastra/pg': minor
---

Changed JSON columns from TEXT to JSONB in `mastra_threads` and `mastra_workflow_snapshot` tables.

**Why this change?**

These were the last remaining columns storing JSON as TEXT. This change aligns them with other tables that already use JSONB, enabling native PostgreSQL JSON operators and GIN indexing for efficient queries. See [#8978](https://github.com/mastra-ai/mastra/issues/8978) for details.

**Columns Changed:**
- `mastra_threads.metadata` - Thread metadata
- `mastra_workflow_snapshot.snapshot` - Workflow run state

**PostgreSQL Migration Required**

PostgreSQL users with existing tables must migrate the column types. Other databases (LibSQL, ClickHouse, etc.) do not require migration.

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

New installations automatically use JSONB. Existing applications continue to work without migration, but JSONB-specific features (native operators, GIN indexing) require the migration.
