# Issue #6691 Summary: PgVector listIndexes() returns table names instead of index names

## Problem Description

The `listIndexes()` method in the `PgVector` class (stores/pg/src/vector/index.ts) is incorrectly returning table names that contain vector columns instead of returning actual index names. This causes initialization to fail when the code tries to describe these tables as if they were indexes.

## Root Cause

### Current Implementation (Line 624-650)

```typescript
async listIndexes(): Promise<string[]> {
  const client = await this.pool.connect();
  try {
    // Then let's see which ones have vector columns
    const vectorTablesQuery = `
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = $1
      AND udt_name = 'vector';
    `;
    const vectorTables = await client.query(vectorTablesQuery, [this.schema || 'public']);
    return vectorTables.rows.map(row => row.table_name);
  } catch (e) {
    // error handling
  }
}
```

**Issue**: This query returns ALL tables in the schema that have vector columns, not just tables managed by Mastra's PgVector class.

### Where It's Called (Line 107-120)

During PgVector initialization:

```typescript
void (async () => {
  const existingIndexes = await this.listIndexes();
  void existingIndexes.map(async indexName => {
    const info = await this.getIndexInfo({ indexName });
    // ... cache the index info
  });
})();
```

### How It Fails

1. `listIndexes()` returns all tables with vector columns (e.g., "dam_embedding_collections")
2. `getIndexInfo()` is called with these table names
3. `getIndexInfo()` calls `describeIndex()`
4. `describeIndex()` expects tables created by PgVector with specific structure (embedding column, etc.)
5. When it queries for the 'embedding' column that doesn't exist in non-Mastra tables, it fails

## Impact

- **Initialization Failure**: PgVector fails to initialize if ANY other tables with vector columns exist in the database
- **Multi-tenancy Issues**: Cannot use pgvector for multiple purposes in the same database
- **Error**: `MastraError: Cannot read properties of undefined (reading 'dimension')`

## Architecture Context

### PgVector Table Naming Convention

- When creating an index with name `foo`, PgVector creates:
  - Table: `foo` (or `schema.foo` if schema is specified)
  - Vector index: `foo_vector_idx`

### Current Test Expectations

From the test file (line 240):

- Test describes it as "should list all vector tables"
- This suggests the current behavior might be intentional but poorly named

## Analysis of How to Identify Mastra Tables

PgVector tables have a specific structure (from line 461-466):

```sql
CREATE TABLE IF NOT EXISTS ${tableName} (
  id SERIAL PRIMARY KEY,
  vector_id TEXT UNIQUE NOT NULL,
  embedding vector(${dimension}),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

Key identifiers of Mastra-managed tables:

1. Have exactly these columns: `id`, `vector_id`, `embedding`, `metadata`
2. `embedding` column is of type `vector`
3. `vector_id` is TEXT UNIQUE NOT NULL
4. `metadata` is JSONB with default value

## Proposed Solution

The method should only return tables that were created and managed by PgVector, not ALL tables with vector columns. Options:

1. **Option 1 (Recommended)**: Query tables that have the exact column structure
   - Check for tables with `vector_id`, `embedding`, and `metadata` columns
   - This is the most reliable way to identify Mastra-managed tables

2. **Option 2**: Add a comment or metadata to tables when creating them
   - Use PostgreSQL table comments to mark Mastra-managed tables
   - Check for this marker in `listIndexes()`

3. **Option 3**: Track created tables in a separate metadata table
   - More complex but provides complete control

## Test Coverage Added

I've successfully reproduced the issue with a test in `stores/pg/src/vector/index.test.ts` (lines 252-336):

```
DB_URL="postgresql://postgres:postgres@localhost:5432/mastra" pnpm vitest run -t "listIndexes with external vector tables" --reporter=dot --bail 1
```

1. Created an external table `dam_embedding_collections` with a vector column (simulating real-world usage)
2. Created a Mastra-managed table
3. Test confirms `listIndexes()` incorrectly returns both tables
4. Test reproduces the exact error: "Cannot read properties of undefined (reading 'dimension')" when initialization tries to describe the external table

The test output shows:

- `listIndexes()` returns both `dam_embedding_collections` and the Mastra-managed table
- The initialization fails with the exact error from the issue when it tries to call `describeIndex` on the external table

## Related Code Files

- **Bug Location**: `/stores/pg/src/vector/index.ts` lines 624-650 (listIndexes method)
- **Initialization**: lines 107-120
- **describeIndex**: lines 658-764
- **Tests**: `/stores/pg/src/vector/index.test.ts` lines 230-250

## Workaround Used by User

User created a wrapper class that overrides `listIndexes` to return empty array:

```typescript
export class SafePgVector extends PgVector {
  async listIndexes() {
    return []; // Prevent the buggy method from causing issues
  }
}
```

## Next Steps

1. Write a test that reproduces the issue with an external table containing vector columns
2. Fix the `listIndexes()` method to only return tables managed by PgVector
3. Consider renaming the method or updating its documentation to clarify its purpose
