# Vector Store Source Management - Executive Summary

## TL;DR

**The user's proposal is good, but they don't realize Mastra already has 90% of what they need!**

Your PG Vector store already has:

- ✅ JSONB metadata storage
- ✅ Powerful MongoDB-like filter operators (`$eq`, `$in`, `$and`, `$or`, etc.)
- ✅ Filter translation infrastructure
- ✅ SQL query builder for complex filters

**What's missing:**

- ❌ `deleteVectorsByFilter()` method (currently can only delete by single ID)
- ❌ Optional `deleteFilter` param in `upsert()` for "delete-then-insert" pattern
- ❌ RAG package doesn't automatically attach source metadata to chunks

## Key Insight

Instead of adding a special `source_id` column or field, **leverage your existing metadata filtering system**:

```typescript
// Store chunks with source metadata
await pgVector.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(c => ({
    text: c.text,
    source_id: 'document.pdf', // Easy filtering
    bucket: 'user_docs', // Multi-tenancy
    indexed_at: new Date().toISOString(), // Temporal management
    version: '2.0', // Versioning
  })),
});

// Later: Update the document (delete old chunks, insert new ones)
await pgVector.upsert({
  indexName: 'docs',
  vectors: newEmbeddings,
  metadata: newChunks.map(c => ({ text: c.text, source_id: 'document.pdf' })),
  deleteFilter: { source_id: 'document.pdf' }, // 🔥 NEW: Delete old first
});

// Or: Delete by any filter
await pgVector.deleteVectorsByFilter({
  indexName: 'docs',
  filter: {
    $and: [{ bucket: 'temp' }, { indexed_at: { $lt: '2025-01-01' } }],
  },
});
```

## Architecture Benefits

### What Makes This The Right Solution

1. **No Schema Changes**: Uses existing JSONB metadata column
2. **Flexible**: Not limited to `source_id` - filter on anything
3. **Already Battle-Tested**: Leverages your existing filter infrastructure
4. **Minimal Code**: Just add `deleteVectorsByFilter()` + optional `deleteFilter` param
5. **Extensible**: Works for multi-tenancy, versioning, temporal cleanup, etc.

### What Your Codebase Already Has

```typescript
// Your PG Vector already supports this in queries:
await pgVector.query({
  indexName: 'docs',
  queryVector: embedding,
  filter: {
    // ✅ Already works!
    $and: [{ source_id: 'doc.pdf' }, { bucket: 'user_docs' }, { version: { $gte: '2.0' } }],
  },
});
```

**You just need to extend this to deletions!**

## Proposed Changes

### 1. Core API (Minimal)

```typescript
// packages/core/src/vector/types.ts
export interface DeleteVectorsByFilterParams<Filter> {
  indexName: string;
  filter: Filter;
}

// packages/core/src/vector/vector.ts
abstract class MastraVector<Filter> {
  abstract deleteVectorsByFilter(params: DeleteVectorsByFilterParams<Filter>): Promise<void>;
}

// packages/core/src/vector/types.ts
export interface UpsertVectorParams<Filter> {
  // ... existing fields ...
  deleteFilter?: Filter; // NEW: Optional delete-first pattern
}
```

### 2. PG Implementation

```typescript
// stores/pg/src/vector/index.ts

// Reuse existing filter infrastructure!
async deleteVectorsByFilter({ indexName, filter }) {
  const translatedFilter = this.transformFilter(filter);
  const { sql, values } = buildFilterQuery(translatedFilter, -1, MAX_INT);

  await client.query(`
    DELETE FROM ${tableName}
    WHERE ${extractWhereClause(sql)}
  `, values);
}

// Update upsert to support deleteFilter
async upsert({ indexName, vectors, metadata, deleteFilter }) {
  await client.query('BEGIN');

  if (deleteFilter) {
    await this.deleteVectorsByFilter({ indexName, filter: deleteFilter });
  }

  // ... existing upsert logic ...

  await client.query('COMMIT');
}
```

### 3. RAG Integration (Nice-to-Have)

```typescript
// packages/rag/src/document/types.ts
export interface SourceMetadata {
  id: string;
  type?: string;
  path?: string;
  [key: string]: any;
}

// packages/rag/src/document/document.ts
class MDocument {
  async chunk(config, sourceMetadata?: SourceMetadata) {
    const chunks = await this.performChunking(config);

    // Attach source metadata to all chunks
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        source: sourceMetadata,
      },
    }));
  }
}
```

## Real-World Use Cases

### Use Case 1: Update a PDF

```typescript
// Version 1
await upsertDocument(doc1, { source_id: 'manual.pdf', version: '1.0' });

// Version 2 (later) - automatically deletes v1 chunks
await upsertDocument(doc2, { source_id: 'manual.pdf', version: '2.0' });
```

### Use Case 2: Multi-Tenant SaaS

```typescript
// Each tenant's docs isolated by metadata
await pgVector.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(c => ({
    text: c.text,
    tenant_id: 'acme-corp',
    source_id: 'report-q4.pdf',
  })),
  deleteFilter: {
    tenant_id: 'acme-corp',
    source_id: 'report-q4.pdf',
  },
});

// Query only tenant's docs
await pgVector.query({
  indexName: 'docs',
  queryVector: embedding,
  filter: { tenant_id: 'acme-corp' }, // Enforces isolation
});
```

### Use Case 3: Temporal Cleanup

```typescript
// Delete old temporary documents
await pgVector.deleteVectorsByFilter({
  indexName: 'docs',
  filter: {
    $and: [{ bucket: 'temp' }, { indexed_at: { $lt: thirtyDaysAgo } }],
  },
});
```

## Why NOT Add a Separate source_id Column

The issue author suggested adding `source_id` as a column. **Don't do this:**

### ❌ Cons of Separate Column

- Inflexible (only one dimension)
- Schema migration required
- Doesn't scale to multi-tenancy, versioning, etc.
- You'd need MORE columns later (bucket_id, tenant_id, etc.)

### ✅ Pros of Metadata Approach

- Infinite dimensions (source_id, bucket, tenant, version, etc.)
- No schema changes
- Works with existing filter system
- Can add new dimensions anytime
- Consistent with Mastra's design

## Implementation Priority

1. **Phase 1** (Core - Do First):
   - Add `deleteVectorsByFilter()` to PG Vector
   - Add `deleteFilter` param to `upsert()`
   - Write tests
   - Update docs

2. **Phase 2** (RAG Integration):
   - Add `SourceMetadata` to chunks
   - Add helper functions
   - Create examples

3. **Phase 3** (Other Stores):
   - Extend to MongoDB, Pinecone, Qdrant, etc.
   - Document which stores support it

## Migration for Users

**Before** (painful):

```typescript
// Users have to track IDs manually
const ids = await storeChunks(doc);
await storage.saveMapping('doc.pdf', ids); // Extra storage needed!

// Later...
const ids = await storage.getMapping('doc.pdf');
for (const id of ids) {
  await pgVector.deleteVector({ indexName: 'docs', id });
}
```

**After** (simple):

```typescript
// Just use metadata
await pgVector.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(c => ({ text: c.text, source_id: 'doc.pdf' })),
  deleteFilter: { source_id: 'doc.pdf' }, // Handles everything!
});
```

## Performance Considerations

### Indexing for Fast Filters

```sql
-- Add GIN index for frequently filtered fields
CREATE INDEX idx_metadata_source ON vector_table
USING GIN ((metadata->'source_id'));

CREATE INDEX idx_metadata_tenant ON vector_table
USING GIN ((metadata->'tenant_id'));
```

### Benchmarks Needed

- [ ] Delete by filter on 1M vectors
- [ ] Concurrent upserts with deleteFilter
- [ ] Complex filter performance

## Decision Matrix

| Approach                      | Flexibility | Code Changes | Schema Changes     | Extends to Other Use Cases |
| ----------------------------- | ----------- | ------------ | ------------------ | -------------------------- |
| **Separate source_id column** | Low         | Medium       | **Yes (Breaking)** | No                         |
| **Metadata + Filters**        | **High**    | **Small**    | **No**             | **Yes**                    |
| **Option B from issue**       | High        | Large        | No                 | Yes                        |

**Recommendation**: Metadata + Filters (essentially Option B, but simpler)

## Questions to Answer

1. ✅ Should we support this in all vector stores?
   - **Yes, but start with PG. Others can return "not supported" initially.**

2. ✅ How to handle vector stores without filtering?
   - **Throw clear error: "deleteVectorsByFilter not supported for [store]"**

3. ✅ Should deleteFilter in upsert be inside a transaction?
   - **Yes, already handled with BEGIN/COMMIT in PG**

4. ✅ Do we need batch deletion limits?
   - **Optional: Add `maxDelete` safety param to prevent accidental mass deletion**

## Next Steps

1. Review this analysis
2. If approved, create detailed implementation plan
3. Start with PG Vector implementation
4. Add comprehensive tests
5. Update documentation
6. Create migration guide
7. Extend to other vector stores

---

**Bottom Line**: The user's problem is real and important. Your architecture already supports 90% of the solution - you just need to expose it through `deleteVectorsByFilter()` and integrate it with your RAG package. This is a relatively small change with huge value.
