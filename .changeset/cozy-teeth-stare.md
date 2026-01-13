---
'@mastra/core': minor
'@mastra/pg': minor
---

Changed the `metadata` column in `mastra_threads` table from TEXT to JSONB.

**Why this change?**

The threads metadata column was the only metadata column still using TEXT type. This change aligns it with other tables (`mastra_resources`, `mastra_scorers`, `mastra_spans`, `mastra_agents`) that already use JSONB, enabling native PostgreSQL JSON operators and GIN indexing for efficient metadata queries. See [#8978](https://github.com/mastra-ai/mastra/issues/8978) for details.

**PostgreSQL Migration Required**

PostgreSQL users with existing tables must migrate the column type. Other databases (LibSQL, ClickHouse, etc.) do not require migration.

*Option 1: Use the helper method (recommended)*
```typescript
const store = new PostgresStore({ id: 'my-store', connectionString: '...' });
await store.init();
const result = await store.migrateThreadsMetadataToJsonb();
```

*Option 2: Run SQL directly*
```sql
ALTER TABLE mastra_threads
ALTER COLUMN metadata TYPE jsonb
USING metadata::jsonb;
```

New installations automatically use JSONB. Existing applications continue to work without migration, but JSONB-specific features (native operators, GIN indexing) require the migration.
