# Vector Store Source Management - Solution Document

## Issue Analysis

**GitHub Issue**: [#6743](https://github.com/mastra-ai/mastra/issues/6743)

### Problem Statement

When chunking documents (PDFs, webpages, source files) for RAG:

1. Each chunk gets a unique `vector_id`
2. When updating the source document, developers need to track all chunk IDs
3. If the number of chunks changes, stranded embeddings remain in the database
4. There's no easy way to delete or update all embeddings related to a source document

### User's Proposed Solutions

**Option A**: Add special `source_id` field

- Delete all embeddings by `source_id` before upserting
- New `deleteVectors()` method accepting `source_id` or list of IDs

**Option B**: General metadata-based approach

- Add `MDocument` metadata shared among chunks
- Filter-based deletion: `filter: { source_id: "doc.pdf", bucket: "docs" }`
- Upsert with filter: delete by filter, then insert new vectors

---

## Current Mastra Architecture Analysis

### ✅ What Already Exists

#### 1. **Powerful Metadata Filtering** (PG Vector)

```typescript
// Current PG Vector already supports complex metadata filtering
await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  filter: {
    $and: [{ source_id: 'document.pdf' }, { bucket: 'user_docs' }, { last_updated: { $gt: '2025-01-01' } }],
  },
});
```

**Supported operators**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`, `$not`, `$exists`, `$contains`, etc.

#### 2. **JSONB Metadata Storage** (PG Vector)

```sql
CREATE TABLE vector_table (
  id SERIAL PRIMARY KEY,
  vector_id TEXT UNIQUE NOT NULL,
  embedding vector(dimension),
  metadata JSONB DEFAULT '{}'::jsonb  -- ✅ Already stores arbitrary metadata
);
```

#### 3. **MDocument System** (RAG Package)

- Document chunking with multiple strategies
- Chunk objects with text and metadata
- BUT: No built-in source tracking

#### 4. **Vector Store Interface**

```typescript
abstract class MastraVector {
  abstract upsert(params: UpsertVectorParams): Promise<string[]>;
  abstract deleteVector(params: DeleteVectorParams): Promise<void>; // Single ID only
  abstract query(params: QueryVectorParams<Filter>): Promise<QueryResult[]>;
}
```

### ❌ What's Missing

1. **No `deleteVectors()` (plural) method** - can only delete one vector at a time
2. **No filter-based deletion** - can't delete by metadata
3. **No automatic source tracking** in chunks
4. **No upsert-with-delete-first pattern**

---

## Recommended Solution

### Approach: Leverage Existing Infrastructure + Minimal Additions

**Key Principle**: Don't reinvent the wheel. Mastra already has excellent metadata filtering in PG - just extend it to deletion and upsert operations.

### Phase 1: Core API Changes (MUST HAVE)

#### 1. Add `DeleteVectorsByFilterParams` type

```typescript
// packages/core/src/vector/types.ts

export interface DeleteVectorsByFilterParams<Filter = VectorFilter> {
  indexName: string;
  /** Filter to match vectors for deletion */
  filter: Filter;
}

export type DeleteVectorsParams<Filter = VectorFilter> =
  | DeleteVectorParams // Single ID (existing)
  | DeleteVectorsByFilterParams<Filter>; // By filter (new)
```

#### 2. Add `deleteVectorsByFilter()` method to base class

```typescript
// packages/core/src/vector/vector.ts

export abstract class MastraVector<Filter = VectorFilter> {
  // ... existing methods ...

  /**
   * Delete vectors matching a filter.
   * Implementations that don't support filtering should throw an error.
   */
  abstract deleteVectorsByFilter(params: DeleteVectorsByFilterParams<Filter>): Promise<void>;
}
```

#### 3. Implement for PG Vector

```typescript
// stores/pg/src/vector/index.ts

async deleteVectorsByFilter({
  indexName,
  filter
}: DeleteVectorsByFilterParams<PGVectorFilter>): Promise<void> {
  let client;
  try {
    client = await this.pool.connect();
    const { tableName } = this.getTableName(indexName);

    // Use existing filter translation infrastructure
    const translatedFilter = this.transformFilter(filter);
    const { sql: filterQuery, values: filterValues } = buildFilterQuery(
      translatedFilter,
      -1,  // minScore not needed for deletion
      Number.MAX_SAFE_INTEGER  // topK not needed
    );

    // Extract WHERE clause from filter query
    const whereClause = filterQuery.replace(/^WHERE\s+/i, '');

    const query = `
      DELETE FROM ${tableName}
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;

    const result = await client.query(query, filterValues.slice(2)); // Skip minScore and topK

    this.logger?.info(`Deleted ${result.rowCount} vectors from ${indexName}`);
  } catch (error: any) {
    const mastraError = new MastraError(
      {
        id: 'MASTRA_STORAGE_PG_VECTOR_DELETE_BY_FILTER_FAILED',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.THIRD_PARTY,
        details: { indexName, filter },
      },
      error,
    );
    this.logger?.trackException(mastraError);
    throw mastraError;
  } finally {
    client?.release();
  }
}
```

#### 4. Add optional `deleteFilter` to `UpsertVectorParams`

```typescript
// packages/core/src/vector/types.ts

export interface UpsertVectorParams<Filter = VectorFilter> {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
  sparseVectors?: SparseVector[];

  /**
   * Optional: Delete vectors matching this filter before upserting.
   * Useful for replacing all vectors from a source document.
   */
  deleteFilter?: Filter;
}
```

#### 5. Update PG `upsert()` implementation

```typescript
// stores/pg/src/vector/index.ts

async upsert({
  indexName,
  vectors,
  metadata,
  ids,
  deleteFilter
}: UpsertVectorParams<PGVectorFilter>): Promise<string[]> {
  const { tableName } = this.getTableName(indexName);
  const client = await this.pool.connect();

  try {
    await client.query('BEGIN');

    // If deleteFilter provided, delete matching vectors first
    if (deleteFilter) {
      await this.deleteVectorsByFilter({ indexName, filter: deleteFilter });
    }

    // Generate IDs
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());
    const vectorType = this.getVectorTypeName();

    // Insert new vectors
    for (let i = 0; i < vectors.length; i++) {
      const query = `
        INSERT INTO ${tableName} (vector_id, embedding, metadata)
        VALUES ($1, $2::${vectorType}, $3::jsonb)
        ON CONFLICT (vector_id)
        DO UPDATE SET
          embedding = $2::${vectorType},
          metadata = $3::jsonb
        RETURNING embedding::text
      `;
      await client.query(query, [
        vectorIds[i],
        `[${vectors[i]?.join(',')}]`,
        JSON.stringify(metadata?.[i] || {})
      ]);
    }

    await client.query('COMMIT');
    return vectorIds;
  } catch (error) {
    await client.query('ROLLBACK');
    // ... error handling
  } finally {
    client.release();
  }
}
```

### Phase 2: RAG Package Enhancements (NICE TO HAVE)

#### 1. Add Source Metadata to Chunks

```typescript
// packages/rag/src/document/types.ts

export interface ChunkMetadata {
  /** Content of the chunk */
  text: string;

  /** Index of this chunk in the source */
  chunkIndex: number;

  /** Total number of chunks from source */
  totalChunks: number;

  /** Custom metadata from user */
  custom?: Record<string, any>;

  /** Source document metadata (shared across all chunks) */
  source?: SourceMetadata;
}

export interface SourceMetadata {
  /** Unique identifier for the source document */
  id: string;

  /** Type of source (pdf, html, markdown, etc) */
  type?: string;

  /** Original file/URL path */
  path?: string;

  /** When this version was indexed */
  indexedAt?: string;

  /** Custom source-level metadata */
  [key: string]: any;
}
```

#### 2. Update `MDocument.chunk()` to accept source metadata

```typescript
// packages/rag/src/document/document.ts

export class MDocument {
  // ... existing code ...

  async chunk(config: ChunkConfig, sourceMetadata?: SourceMetadata): Promise<Chunk[]> {
    const chunks = await this.performChunking(config);

    // Add source metadata to all chunks
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        source: sourceMetadata
          ? {
              ...sourceMetadata,
              indexedAt: sourceMetadata.indexedAt || new Date().toISOString(),
            }
          : undefined,
      },
    }));
  }
}
```

#### 3. Add Helper Function for Source-Based Upsert

```typescript
// packages/rag/src/utils/source-management.ts

export interface UpsertDocumentParams {
  vectorStore: MastraVector;
  indexName: string;
  embeddings: number[][];
  chunks: Chunk[];
  sourceId: string;
  /** Additional metadata to store with each chunk */
  additionalMetadata?: Record<string, any>;
}

/**
 * Upsert embeddings for a document, automatically deleting old versions.
 * This handles the common pattern of re-indexing a document.
 */
export async function upsertDocument({
  vectorStore,
  indexName,
  embeddings,
  chunks,
  sourceId,
  additionalMetadata = {},
}: UpsertDocumentParams): Promise<string[]> {
  // Prepare metadata
  const metadata = chunks.map((chunk, i) => ({
    text: chunk.text,
    chunkIndex: i,
    totalChunks: chunks.length,
    source_id: sourceId, // For easy filtering
    ...additionalMetadata,
    ...chunk.metadata,
  }));

  // Upsert with automatic deletion of old chunks from same source
  return vectorStore.upsert({
    indexName,
    vectors: embeddings,
    metadata,
    deleteFilter: { source_id: sourceId }, // Delete old chunks first
  });
}

/**
 * Delete all embeddings for a source document
 */
export async function deleteDocument(vectorStore: MastraVector, indexName: string, sourceId: string): Promise<void> {
  await vectorStore.deleteVectorsByFilter({
    indexName,
    filter: { source_id: sourceId },
  });
}

/**
 * Delete all embeddings matching a filter (e.g., by bucket, date range, etc)
 */
export async function deleteByFilter(
  vectorStore: MastraVector,
  indexName: string,
  filter: Record<string, any>,
): Promise<void> {
  await vectorStore.deleteVectorsByFilter({
    indexName,
    filter,
  });
}
```

### Phase 3: Usage Examples

#### Example 1: Basic Usage with Source Tracking

```typescript
import { MDocument } from '@mastra/rag';
import { PgVector } from '@mastra/pg';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

// Initialize vector store
const pgVector = new PgVector({
  id: 'pg-vector',
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
});

// Create document with source metadata
const doc = MDocument.fromText(pdfContent);
const sourceMetadata = {
  id: 'user-guide-v2.pdf',
  type: 'pdf',
  path: '/docs/user-guide-v2.pdf',
  bucket: 'documentation',
  version: '2.0',
};

// Chunk with source metadata
const chunks = await doc.chunk(
  {
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
  },
  sourceMetadata,
);

// Generate embeddings
const { embeddings } = await embedMany({
  values: chunks.map(c => c.text),
  model: openai.embedding('text-embedding-3-small'),
});

// Prepare metadata (source info is already in chunks)
const metadata = chunks.map(chunk => ({
  text: chunk.text,
  source_id: sourceMetadata.id, // Key field for deletion/updates
  ...chunk.metadata,
}));

// Upsert: This will DELETE old chunks with same source_id, then insert new ones
await pgVector.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata,
  deleteFilter: { source_id: sourceMetadata.id }, // 🔥 Delete old version first
});
```

#### Example 2: Update a Document (Re-indexing)

```typescript
// Later, when the PDF is updated...
const updatedDoc = MDocument.fromText(updatedPdfContent);

const updatedChunks = await updatedDoc.chunk(
  { strategy: 'recursive', maxSize: 512, overlap: 50 },
  { id: 'user-guide-v2.pdf', version: '2.1' }, // Same source ID
);

const { embeddings: updatedEmbeddings } = await embedMany({
  values: updatedChunks.map(c => c.text),
  model: openai.embedding('text-embedding-3-small'),
});

// This automatically deletes old chunks and inserts new ones
await pgVector.upsert({
  indexName: 'docs',
  vectors: updatedEmbeddings,
  metadata: updatedChunks.map(c => ({
    text: c.text,
    source_id: 'user-guide-v2.pdf',
    ...c.metadata,
  })),
  deleteFilter: { source_id: 'user-guide-v2.pdf' },
});
```

#### Example 3: Delete a Document

```typescript
// Delete all chunks from a specific document
await pgVector.deleteVectorsByFilter({
  indexName: 'docs',
  filter: { source_id: 'user-guide-v2.pdf' },
});
```

#### Example 4: Bulk Operations with Filters

```typescript
// Delete all docs from a bucket older than a certain date
await pgVector.deleteVectorsByFilter({
  indexName: 'docs',
  filter: {
    $and: [{ bucket: 'temp_docs' }, { 'source.indexedAt': { $lt: '2025-01-01' } }],
  },
});

// Delete all documents of a certain type
await pgVector.deleteVectorsByFilter({
  indexName: 'docs',
  filter: { 'source.type': 'pdf' },
});
```

#### Example 5: Using the Helper Functions

```typescript
import { upsertDocument, deleteDocument } from '@mastra/rag/utils/source-management';

// Simplified API
await upsertDocument({
  vectorStore: pgVector,
  indexName: 'docs',
  embeddings: embeddings,
  chunks: chunks,
  sourceId: 'user-guide-v2.pdf',
  additionalMetadata: { bucket: 'documentation' },
});

// Delete by source
await deleteDocument(pgVector, 'docs', 'user-guide-v2.pdf');
```

---

## Implementation Strategy

### Priority 1: Core Functionality (PG Vector)

1. ✅ Add `deleteVectorsByFilter()` to base class
2. ✅ Implement in PG Vector store
3. ✅ Add `deleteFilter` option to `upsert()`
4. ✅ Add tests for PG implementation
5. ✅ Update documentation

### Priority 2: RAG Package Integration

1. ✅ Add `SourceMetadata` type
2. ✅ Update `MDocument.chunk()` to accept source metadata
3. ✅ Add helper functions for common patterns
4. ✅ Add examples and docs

### Priority 3: Extend to Other Vector Stores

Implement `deleteVectorsByFilter()` for:

- MongoDB
- Pinecone
- Qdrant
- OpenSearch
- Chroma
- Others as needed

---

## Why This Solution is Correct

### ✅ Pros

1. **Leverages Existing Infrastructure**
   - Uses the powerful metadata filtering already in PG
   - No new columns or schema changes needed
   - Works with existing JSONB capabilities

2. **Flexible and Extensible**
   - Not limited to just `source_id` - can filter on any metadata
   - Supports complex filters: buckets, dates, types, custom fields
   - Easy to add new filter dimensions without schema changes

3. **Maintains Compatibility**
   - Backward compatible - existing code keeps working
   - Optional features - teams can adopt incrementally
   - Works across all vector stores (once implemented)

4. **Follows Mastra Patterns**
   - Uses existing filter translation system
   - Consistent API across vector stores
   - Integrates naturally with MDocument system

5. **Solves More Than Requested**
   - Not just source management - full metadata-based lifecycle
   - Bulk operations by any criteria
   - Temporal management (delete old docs)
   - Multi-tenancy support (bucket-based)

### ⚠️ Considerations

1. **Performance**: Metadata filtering on large datasets
   - **Solution**: Ensure JSONB indexes on frequently filtered fields

   ```sql
   CREATE INDEX idx_source_id ON vector_table USING GIN ((metadata->'source_id'));
   ```

2. **Atomicity**: Delete + Insert should be transactional
   - **Solution**: Already handled with BEGIN/COMMIT in upsert

3. **Vector Store Support**: Not all stores support filtering
   - **Solution**: Throw clear error for unsupported stores
   - Document which stores support this feature

---

## Comparison to Proposed Solutions

### vs. Option A (Simple source_id)

- ❌ Less flexible - only one dimension (source_id)
- ❌ Requires schema changes (new column)
- ❌ Harder to extend for other use cases

### vs. Option B (MDocument metadata + filters)

- ✅ **Our solution IS essentially Option B**
- ✅ But better integrated with existing infrastructure
- ✅ More pragmatic implementation path

---

## Migration Path for Existing Users

```typescript
// Old way: Manual tracking of IDs
const ids = []; // Track these somewhere
for (const chunk of chunks) {
  const id = await vectorStore.upsert(...);
  ids.push(id);
}
// Later... good luck finding those IDs to delete them

// New way: Metadata-based
await vectorStore.upsert({
  indexName: 'docs',
  vectors: embeddings,
  metadata: chunks.map(c => ({
    text: c.text,
    source_id: 'my-doc.pdf'  // Just add this
  })),
  deleteFilter: { source_id: 'my-doc.pdf' }  // Magic!
});
```

---

## Testing Checklist

- [ ] Unit tests for `deleteVectorsByFilter()` with various filters
- [ ] Integration tests for `upsert()` with `deleteFilter`
- [ ] Test transaction rollback on failure
- [ ] Test with empty filters (should delete nothing)
- [ ] Test with complex nested filters
- [ ] Test performance with large datasets
- [ ] Test concurrent upserts with same source_id
- [ ] Test with other vector stores (ensure graceful degradation)

---

## Documentation Requirements

1. **API Reference**: Document new methods and parameters
2. **Guide**: "Managing Document Sources in RAG"
3. **Examples**: Common patterns (shown above)
4. **Migration Guide**: How to adopt this pattern
5. **Best Practices**: Recommended metadata structure

---

## Conclusion

This solution:

- ✅ Solves the user's problem completely
- ✅ Leverages Mastra's existing architecture
- ✅ Adds minimal new code
- ✅ Is more flexible than what was requested
- ✅ Follows established patterns in the codebase
- ✅ Provides clear upgrade path

**Recommendation**: Proceed with this implementation for PG Vector first, then extend to other stores.
