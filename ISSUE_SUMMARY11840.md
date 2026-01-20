# Issue Summary: GitHub Issue #11840

## Bug Title

MastraError: could not create unique index "public_mastra_ai_spans_traceid_spanid_pk"

## Problem Description

When users upgrade to newer beta packages (from versions prior to `1.0.0-beta.21`), the PostgresStore initialization fails with an error when trying to add a PRIMARY KEY constraint to the `mastra_ai_spans` table.

### Error Message

```
MastraError: could not create unique index "public_mastra_ai_spans_traceid_spanid_pk"
cause: error: could not create unique index "public_mastra_ai_spans_traceid_spanid_pk"
detail: 'Key ("traceId", "spanId")=(031d5174b27bd90f19a7299214b33208, dd4792145dfc5cf7) is duplicated.'
code: '23505'
```

The PostgreSQL error code `23505` is a unique violation error, meaning there are duplicate entries in the existing data that prevent creating a unique constraint.

## Root Cause Analysis

### 1. New PRIMARY KEY Migration Added in PR #11132

In commit `d171e559ea` (PR #11132 - "Updated observability storage/server/client-js to use the same schemas throughout"), a new PRIMARY KEY constraint was added to the `mastra_ai_spans` table on the composite key `(traceId, spanId)`.

The migration code is in `stores/pg/src/storage/db/index.ts` (lines 217-231):

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '${constraintPrefix}mastra_ai_spans_traceid_spanid_pk'
  ) THEN
    ALTER TABLE ...
    ADD CONSTRAINT ${constraintPrefix}mastra_ai_spans_traceid_spanid_pk
    PRIMARY KEY ("traceId", "spanId");
  END IF;
END $$;
```

### 2. Prior Schema Had No Unique Constraint

Before this PR, the `mastra_ai_spans` table had no unique constraint on `(traceId, spanId)`. This allowed duplicate spans to be inserted.

### 3. How Duplicates Could Have Been Created

The span insertion code (`stores/pg/src/storage/db/index.ts` - `insert()` method and `batchInsert()` method) performs simple INSERT statements without `ON CONFLICT` handling:

```typescript
async insert({ tableName, record }): Promise<void> {
  await this.client.none(
    `INSERT INTO ${tableName} (...) VALUES (...)`,
    values,
  );
}
```

Duplicate spans could have been created through:

- **Retries due to transient errors**: If an insert failed after the DB committed but before the application received confirmation
- **Race conditions**: Multiple processes/threads trying to insert the same span simultaneously
- **Application bugs or crashes**: Partial processing followed by reprocessing
- **Batch processing issues**: The `DefaultExporter` uses batch strategies that could potentially create duplicates if retried

### 4. Migration Doesn't Handle Pre-existing Duplicates

The migration only checks if the constraint exists, but does NOT:

- Check for duplicate `(traceId, spanId)` combinations in existing data
- Deduplicate existing data before adding the constraint
- Handle the case where duplicates exist

## Files Involved

### Key Migration Code

- `stores/pg/src/storage/db/index.ts` (lines 217-231) - The PRIMARY KEY constraint addition code

### Span Insertion Code

- `stores/pg/src/storage/db/index.ts` (lines 436-462) - `insert()` method
- `stores/pg/src/storage/db/index.ts` (lines 733-755) - `batchInsert()` method
- `stores/pg/src/storage/domains/observability/index.ts` (lines 174-205) - `createSpan()` method
- `stores/pg/src/storage/domains/observability/index.ts` (lines 620-649) - `batchCreateSpans()` method

### Existing Migration Tests

- `stores/pg/src/storage/migration.test.ts` - Tests schema migration but doesn't test duplicate handling

## Proposed Fix

The migration needs to handle pre-existing duplicate data before adding the PRIMARY KEY constraint:

1. **Detect duplicates**: Query for duplicate `(traceId, spanId)` combinations
2. **Deduplicate**: Keep only one record per `(traceId, spanId)` - preferably the most recent one (by `updatedAt` or `createdAt`)
3. **Then add constraint**: Only after deduplication, add the PRIMARY KEY

### SQL Logic for Deduplication

```sql
-- Delete duplicate rows, keeping the one with the latest updatedAt
DELETE FROM mastra_ai_spans a
USING mastra_ai_spans b
WHERE a."traceId" = b."traceId"
  AND a."spanId" = b."spanId"
  AND a.ctid < b.ctid;  -- or use updatedAt comparison
```

## Reproduction Strategy

To reproduce this issue in a test:

1. Create the spans table with the OLD schema (no PRIMARY KEY on traceId/spanId)
2. Insert spans with duplicate `(traceId, spanId)` combinations
3. Run the migration that tries to add the PRIMARY KEY constraint
4. Expect the migration to fail with error code 23505

The test should be in `stores/pg/src/storage/migration.test.ts` alongside other migration tests.

## Clarified Requirements

### Deduplication Strategy (Priority Order)

When duplicates exist, keep the record based on this priority:

1. **First**: Keep completed spans (those with `endedAt` IS NOT NULL)
2. **Second**: Keep the most recent by `updatedAt`
3. **Third**: Keep the most recent by `createdAt`

### Logging Requirement

- **Log deleted duplicate rows** before deletion for audit/debugging purposes

### Future Prevention

- **Add ON CONFLICT handling** to insert methods to prevent future duplicates

## Test Plan

### Test 1: Migration Fails with Duplicates (Current Behavior)

- Create table with OLD schema (no PK)
- Insert duplicate spans with same `(traceId, spanId)`
- Run migration
- Expect: Migration fails with error 23505

### Test 2: Deduplication Strategy - Completed Spans Preferred

- Insert duplicates where one has `endedAt` set and one doesn't
- Run deduplication
- Expect: The completed span (with `endedAt`) is kept

### Test 3: Deduplication Strategy - Most Recent updatedAt

- Insert duplicates with different `updatedAt` values (both completed or both not)
- Run deduplication
- Expect: The span with most recent `updatedAt` is kept

### Test 4: Deduplication Strategy - Most Recent createdAt (fallback)

- Insert duplicates with same `updatedAt` but different `createdAt`
- Run deduplication
- Expect: The span with most recent `createdAt` is kept

### Test 5: ON CONFLICT Handling

- Insert a span
- Insert the same span again (same traceId + spanId)
- Expect: No error, second insert is handled gracefully (upsert behavior)

## Affected Stores Analysis

### Stores WITH Observability (Spans Table) - 5 total

Only 5 stores implement observability/spans storage. The others are either vector-only stores or storage adapters that don't include observability.

| Store               | Unique Constraint?             | Affected? | Status                                                   |
| ------------------- | ------------------------------ | --------- | -------------------------------------------------------- |
| **PostgreSQL (pg)** | PRIMARY KEY (traceId, spanId)  | YES       | **FIXED** - Added deduplication + ON CONFLICT            |
| **MSSQL**           | PRIMARY KEY (traceId, spanId)  | YES       | Silent fail - logs warning, continues without constraint |
| **MongoDB**         | Unique index {spanId, traceId} | YES       | Silent fail - logs warning, continues without index      |
| **LibSQL**          | None                           | NO        | Missing unique constraint (oversight?)                   |
| **ClickHouse**      | PRIMARY KEY (ordering only)    | NO        | ClickHouse PRIMARY KEY doesn't enforce uniqueness        |

### Exact Lines Where Constraints Are Added

#### PostgreSQL (`stores/pg/src/storage/db/index.ts`)

**Lines 821-823** - Adds PRIMARY KEY via ALTER TABLE:

```sql
ALTER TABLE ${fullTableName}
ADD CONSTRAINT ${constraintName}
PRIMARY KEY ("traceId", "spanId")
```

#### MSSQL (`stores/mssql/src/storage/db/index.ts`)

**Line 447** - Adds PRIMARY KEY via ALTER TABLE:

```sql
ALTER TABLE ... ADD CONSTRAINT [${pkConstraintName}] PRIMARY KEY ([traceId], [spanId])
```

#### MongoDB (`stores/mongodb/src/storage/domains/observability/index.ts`)

**Line 59** - Creates unique index:

```typescript
{ collection: TABLE_SPANS, keys: { spanId: 1, traceId: 1 }, options: { unique: true } }
```

#### LibSQL (`stores/libsql/src/storage/db/index.ts`)

**Lines 557-561** - Only adds UNIQUE constraint for `TABLE_WORKFLOW_SNAPSHOT`, NOT for spans:

```typescript
const tableConstraints: string[] = [];
if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
  tableConstraints.push('UNIQUE (workflow_name, run_id)');
}
// NO equivalent for TABLE_SPANS - appears to be an oversight
```

#### ClickHouse (`stores/clickhouse/src/storage/db/index.ts`)

**Lines 162-163** - Uses PRIMARY KEY but it's NOT a uniqueness constraint:

```sql
PRIMARY KEY (createdAt, traceId, spanId)
ORDER BY (createdAt, traceId, spanId)
```

In ClickHouse, `PRIMARY KEY` is only used for sorting/ordering data, NOT for enforcing uniqueness. ClickHouse is an OLAP database that explicitly allows duplicate rows by design.

### Stores WITHOUT Observability - 19 total

These stores do not implement observability/spans and are NOT affected:

| Store         | Type                                                             |
| ------------- | ---------------------------------------------------------------- |
| astra         | Vector only                                                      |
| chroma        | Vector only                                                      |
| cloudflare    | Storage (KV) - has memory/workflows/scores, NO observability     |
| cloudflare-d1 | Storage (D1) - has memory/workflows/scores, NO observability     |
| convex        | Storage + Vector - has memory/workflows/scores, NO observability |
| couchbase     | Vector only                                                      |
| duckdb        | Vector only                                                      |
| dynamodb      | Storage - has memory/workflows/scores, NO observability          |
| elasticsearch | Vector only                                                      |
| lance         | Vector only                                                      |
| opensearch    | Vector only                                                      |
| pinecone      | Vector only                                                      |
| qdrant        | Vector only                                                      |
| s3vectors     | Vector only                                                      |
| turbopuffer   | Vector only                                                      |
| upstash       | Storage + Vector - has memory/workflows/scores, NO observability |
| vectorize     | Vector only                                                      |

### Remaining Work

1. **MSSQL**: Needs deduplication logic similar to PostgreSQL fix
2. **MongoDB**: Needs deduplication logic similar to PostgreSQL fix
3. **LibSQL**: Consider adding unique constraint (currently missing)
