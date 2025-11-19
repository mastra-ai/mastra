# Vector Store Source Management - Implementation Roadmap

## Overview

This roadmap breaks down the implementation into manageable phases with clear deliverables and testing criteria.

## Phase 1: Core PG Vector Implementation (Week 1-2)

### 1.1 Update Core Types

**File**: `packages/core/src/vector/types.ts`

**Changes**:

````typescript
// Add new param interface
export interface DeleteVectorsByFilterParams<Filter = VectorFilter> {
  indexName: string;
  filter: Filter;
}

// Update UpsertVectorParams
export interface UpsertVectorParams<Filter = VectorFilter> {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
  sparseVectors?: SparseVector[];

  /**
   * Optional filter to delete vectors before upserting.
   * Useful for replacing all chunks from a source document.
   *
   * @example
   * ```ts
   * await vectorStore.upsert({
   *   indexName: 'docs',
   *   vectors: embeddings,
   *   metadata: chunks.map(c => ({ text: c.text, source_id: 'doc.pdf' })),
   *   deleteFilter: { source_id: 'doc.pdf' }
   * });
   * ```
   */
  deleteFilter?: Filter;
}
````

**Tests**:

- [ ] Type checking compiles
- [ ] Backward compatibility (existing code works without deleteFilter)

**Estimate**: 2 hours

---

### 1.2 Update Base Vector Class

**File**: `packages/core/src/vector/vector.ts`

**Changes**:

````typescript
export abstract class MastraVector<Filter = VectorFilter> extends MastraBase {
  // ... existing methods ...

  /**
   * Delete vectors matching a metadata filter.
   *
   * This enables bulk deletion and source-based management.
   * Implementations should throw MastraError with VECTOR_FILTER_DELETE_NOT_SUPPORTED
   * if filtering is not supported.
   *
   * @param params - Parameters including indexName and filter
   * @throws {MastraError} If filter deletion is not supported
   *
   * @example
   * ```ts
   * // Delete all chunks from a document
   * await vectorStore.deleteVectorsByFilter({
   *   indexName: 'docs',
   *   filter: { source_id: 'manual.pdf' }
   * });
   *
   * // Delete old temporary documents
   * await vectorStore.deleteVectorsByFilter({
   *   indexName: 'docs',
   *   filter: {
   *     $and: [
   *       { bucket: 'temp' },
   *       { indexed_at: { $lt: '2025-01-01' } }
   *     ]
   *   }
   * });
   * ```
   */
  abstract deleteVectorsByFilter(params: DeleteVectorsByFilterParams<Filter>): Promise<void>;
}
````

**Tests**:

- [ ] Abstract method exists
- [ ] Type signature is correct

**Estimate**: 1 hour

---

### 1.3 Implement PG Vector deleteVectorsByFilter

**File**: `stores/pg/src/vector/index.ts`

**Changes**:

```typescript
async deleteVectorsByFilter({
  indexName,
  filter
}: DeleteVectorsByFilterParams<PGVectorFilter>): Promise<void> {
  let client;
  try {
    client = await this.pool.connect();
    const { tableName } = this.getTableName(indexName);

    if (!filter || Object.keys(filter).length === 0) {
      // Safety: Don't allow empty filters (would delete everything)
      throw new MastraError({
        id: 'MASTRA_STORAGE_PG_VECTOR_DELETE_EMPTY_FILTER',
        text: 'Cannot delete with empty filter. Use deleteIndex to delete all vectors.',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Translate filter using existing infrastructure
    const translatedFilter = this.transformFilter(filter);
    const { sql: filterQuery, values: filterValues } = buildFilterQuery(
      translatedFilter,
      -1,
      Number.MAX_SAFE_INTEGER
    );

    // Extract WHERE clause (remove "WHERE" prefix if present)
    const whereClause = filterQuery.trim().replace(/^WHERE\s+/i, '');

    if (!whereClause) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_PG_VECTOR_DELETE_INVALID_FILTER',
        text: 'Filter produced empty WHERE clause',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName, filter },
      });
    }

    // Build delete query
    const query = `
      DELETE FROM ${tableName}
      WHERE ${whereClause}
    `;

    // Execute (skip first 2 params which are minScore and topK from buildFilterQuery)
    const params = filterValues.slice(2);
    const result = await client.query(query, params);

    this.logger?.info(
      `Deleted ${result.rowCount} vectors from ${indexName} matching filter`,
      { indexName, filter, deletedCount: result.rowCount }
    );
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

**Tests**:

- [ ] Delete by simple filter (e.g., `{ source_id: 'doc.pdf' }`)
- [ ] Delete by complex filter (e.g., `$and`, `$or`)
- [ ] Empty filter throws error
- [ ] Non-matching filter deletes nothing
- [ ] Returns correct count
- [ ] Proper error handling
- [ ] Transaction safety

**Estimate**: 4 hours (including tests)

---

### 1.4 Update PG Vector upsert

**File**: `stores/pg/src/vector/index.ts`

**Changes**:

```typescript
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

    // Step 1: Delete vectors matching filter (if provided)
    if (deleteFilter) {
      this.logger?.debug(
        `Deleting vectors matching filter before upsert`,
        { indexName, deleteFilter }
      );

      // Use the new deleteVectorsByFilter method
      // Note: This will use the same client/transaction
      await this.deleteVectorsByFilter({ indexName, filter: deleteFilter });
    }

    // Step 2: Generate IDs for new vectors
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());
    const vectorType = this.getVectorTypeName();

    // Step 3: Insert new vectors
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

    this.logger?.info(
      `Upserted ${vectors.length} vectors to ${indexName}`,
      {
        indexName,
        vectorCount: vectors.length,
        hadDeleteFilter: !!deleteFilter
      }
    );

    return vectorIds;
  } catch (error) {
    await client.query('ROLLBACK');

    const mastraError = new MastraError(
      {
        id: 'MASTRA_STORAGE_PG_VECTOR_UPSERT_FAILED',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.THIRD_PARTY,
        details: {
          indexName,
          vectorCount: vectors?.length || 0,
          hadDeleteFilter: !!deleteFilter
        },
      },
      error,
    );

    this.logger?.trackException(mastraError);
    throw mastraError;
  } finally {
    client.release();
  }
}
```

**Tests**:

- [ ] Upsert without deleteFilter works (backward compatibility)
- [ ] Upsert with deleteFilter deletes old vectors
- [ ] Transaction rolls back on error
- [ ] Metadata is properly stored
- [ ] IDs are generated/used correctly
- [ ] Concurrent upserts with same source_id are handled

**Estimate**: 3 hours (including tests)

---

### 1.5 SQL Helper Update

**File**: `stores/pg/src/vector/sql-builder.ts`

**Changes**: None needed! The `buildFilterQuery` function already works.

**Validation**:

- [ ] Review that buildFilterQuery can be used for DELETE statements
- [ ] Ensure parameter indexing works correctly

**Estimate**: 1 hour (review only)

---

## Phase 2: RAG Package Integration (Week 2-3)

### 2.1 Add Source Metadata Types

**File**: `packages/rag/src/document/types.ts`

**Changes**:

```typescript
/**
 * Metadata about the source document, shared across all chunks.
 * This enables source-based management of embeddings.
 */
export interface SourceMetadata {
  /**
   * Unique identifier for the source document.
   * Used for updating/deleting all chunks from this source.
   */
  id: string;

  /** Type of source document (pdf, html, markdown, etc) */
  type?: 'pdf' | 'html' | 'markdown' | 'text' | 'json' | 'latex' | string;

  /** Original file path or URL */
  path?: string;

  /** When this version was indexed (ISO 8601) */
  indexedAt?: string;

  /** Version identifier */
  version?: string;

  /** Organizational bucket/namespace */
  bucket?: string;

  /** Custom metadata fields */
  [key: string]: any;
}

/**
 * Metadata for a single chunk, including optional source information
 */
export interface ChunkWithSource extends Chunk {
  metadata: {
    /** Index of this chunk within the source document */
    chunkIndex?: number;

    /** Total number of chunks from this source */
    totalChunks?: number;

    /** Source document metadata (shared across all chunks) */
    source?: SourceMetadata;

    /** Other custom metadata */
    [key: string]: any;
  };
}
```

**Tests**:

- [ ] Types compile
- [ ] Types are exported

**Estimate**: 1 hour

---

### 2.2 Update MDocument.chunk()

**File**: `packages/rag/src/document/document.ts`

**Changes**:

````typescript
export class MDocument {
  // ... existing code ...

  /**
   * Chunk the document into smaller pieces.
   *
   * @param config - Chunking configuration
   * @param sourceMetadata - Optional metadata about the source document.
   *                        Will be attached to all chunks for source-based management.
   * @returns Array of chunks with text and metadata
   *
   * @example
   * ```ts
   * const doc = MDocument.fromPDF(pdfBuffer);
   * const chunks = await doc.chunk(
   *   { strategy: 'recursive', maxSize: 512, overlap: 50 },
   *   { id: 'manual-v2.pdf', type: 'pdf', bucket: 'docs' }
   * );
   * // All chunks will have source metadata for easy management
   * ```
   */
  async chunk(config: ChunkConfig, sourceMetadata?: SourceMetadata): Promise<ChunkWithSource[]> {
    // Perform chunking using existing logic
    const chunks = await this.performChunking(config);

    // Attach source metadata to all chunks
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...(chunk.metadata || {}),
        chunkIndex: index,
        totalChunks: chunks.length,
        ...(sourceMetadata && {
          source: {
            ...sourceMetadata,
            indexedAt: sourceMetadata.indexedAt || new Date().toISOString(),
          },
        }),
      },
    }));
  }

  // Keep existing method signature for backward compatibility
  // This is the actual implementation that does the chunking
  private async performChunking(config: ChunkConfig): Promise<Chunk[]> {
    // ... existing chunking logic ...
  }
}
````

**Tests**:

- [ ] Chunks without sourceMetadata work (backward compatibility)
- [ ] Chunks with sourceMetadata have source field
- [ ] chunkIndex is set correctly
- [ ] totalChunks is accurate
- [ ] indexedAt is auto-generated if not provided
- [ ] Custom source fields are preserved

**Estimate**: 3 hours (including tests)

---

### 2.3 Add Helper Functions

**File**: `packages/rag/src/utils/source-management.ts` (new file)

**Changes**: See full implementation in VECTOR_STORE_SOURCE_MANAGEMENT_SOLUTION.md

**Key Functions**:

- `upsertDocument()` - High-level helper for document upsert
- `deleteDocument()` - Delete by source ID
- `deleteByFilter()` - Delete by custom filter

**Tests**:

- [ ] upsertDocument properly formats metadata
- [ ] upsertDocument calls vector store with correct params
- [ ] deleteDocument works
- [ ] deleteByFilter works
- [ ] Error handling

**Estimate**: 4 hours (including tests)

---

### 2.4 Update RAG Package Exports

**File**: `packages/rag/src/index.ts`

**Changes**:

```typescript
// ... existing exports ...

// Source management
export type { SourceMetadata, ChunkWithSource } from './document/types';
export { upsertDocument, deleteDocument, deleteByFilter } from './utils/source-management';
```

**Tests**:

- [ ] All exports are accessible
- [ ] No circular dependencies

**Estimate**: 30 minutes

---

## Phase 3: Documentation & Examples (Week 3)

### 3.1 Update Vector Store Docs

**File**: `stores/pg/README.md`

**Add Section**: "Source-Based Vector Management"

**Content**:

- What is source-based management
- Why it's needed
- Examples (update, delete)
- Best practices (metadata structure, indexing)
- Performance considerations

**Estimate**: 3 hours

---

### 3.2 Create RAG Guide

**File**: `docs/src/content/en/docs/rag/source-management.mdx`

**Content**:

- Problem statement
- Solution overview
- Step-by-step tutorial
- Common patterns
- Multi-tenancy example
- Versioning example

**Estimate**: 4 hours

---

### 3.3 Add Examples

**Files**:

- `examples/basics/rag/source-tracking/index.ts`
- `examples/basics/rag/update-document/index.ts`
- `examples/basics/rag/multi-tenant-rag/index.ts`

**Estimate**: 4 hours

---

### 3.4 Update API Reference

**Files**:

- `docs/src/content/en/reference/vectors/pg.mdx`
- `docs/src/content/en/reference/rag/mdocument.mdx`

**Estimate**: 2 hours

---

## Phase 4: Extend to Other Vector Stores (Week 4+)

### 4.1 Implement for MongoDB

**File**: `stores/mongodb/src/vector/index.ts`

**Approach**: Similar to PG, use MongoDB's existing filter support

**Estimate**: 4 hours

---

### 4.2 Implement for Pinecone

**File**: `stores/pinecone/src/vector/index.ts`

**Approach**: Use Pinecone's metadata filtering

**Estimate**: 4 hours

---

### 4.3 Implement for Qdrant

**File**: `stores/qdrant/src/vector/index.ts`

**Approach**: Use Qdrant's filter system

**Estimate**: 4 hours

---

### 4.4 Graceful Degradation for Unsupported Stores

**Approach**: For stores without filtering, throw clear error:

```typescript
async deleteVectorsByFilter(params) {
  throw new MastraError({
    id: 'VECTOR_FILTER_DELETE_NOT_SUPPORTED',
    text: `Vector store ${this.constructor.name} does not support filter-based deletion. ` +
          `Use deleteVector() with individual IDs instead.`,
    domain: ErrorDomain.MASTRA_VECTOR,
    category: ErrorCategory.USER,
    details: { storeName: this.constructor.name }
  });
}
```

**Estimate**: 2 hours across all stores

---

## Phase 5: Performance Optimization (Week 5)

### 5.1 Add JSONB Indexes

**File**: `stores/pg/src/vector/index.ts`

**Add method**:

```typescript
async createSourceIndex(indexName: string, field: string = 'source_id'): Promise<void> {
  const { tableName } = this.getTableName(indexName);
  const client = await this.pool.connect();

  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${indexName}_${field}
      ON ${tableName}
      USING GIN ((metadata->'${field}'))
    `);
  } finally {
    client.release();
  }
}
```

**Estimate**: 2 hours

---

### 5.2 Performance Testing

**Create**: `stores/pg/src/vector/source-management.perf.test.ts`

**Tests**:

- [ ] Delete by filter on 10K vectors
- [ ] Delete by filter on 100K vectors
- [ ] Delete by filter on 1M vectors
- [ ] With and without indexes
- [ ] Complex filters vs simple filters
- [ ] Concurrent operations

**Estimate**: 6 hours

---

## Testing Strategy

### Unit Tests

- [ ] Type definitions
- [ ] Individual methods
- [ ] Error handling
- [ ] Edge cases (empty filters, invalid filters, etc.)

### Integration Tests

- [ ] End-to-end document update flow
- [ ] Multi-tenant isolation
- [ ] Version management
- [ ] Concurrent operations

### Performance Tests

- [ ] Large dataset deletion
- [ ] Index effectiveness
- [ ] Transaction overhead

### Regression Tests

- [ ] Existing code without new features still works
- [ ] Backward compatibility

---

## Rollout Plan

### Week 1-2: Core Implementation

- ✅ Update types
- ✅ Implement PG Vector
- ✅ Unit tests
- ✅ Integration tests

### Week 2-3: RAG Integration

- ✅ Add source metadata
- ✅ Update MDocument
- ✅ Helper functions
- ✅ Tests

### Week 3: Documentation

- ✅ API docs
- ✅ Guides
- ✅ Examples

### Week 4: Other Vector Stores

- ✅ MongoDB
- ✅ Pinecone
- ✅ Qdrant
- ⚠️ Others as needed

### Week 5: Optimization & Polish

- ✅ Performance testing
- ✅ Index creation
- ✅ Bug fixes
- ✅ Documentation polish

---

## Success Criteria

### Functional

- [ ] Can delete vectors by filter in PG Vector
- [ ] Can upsert with automatic deletion
- [ ] Source metadata is properly tracked
- [ ] No stranded embeddings after updates
- [ ] All tests pass

### Performance

- [ ] Delete by filter on 100K vectors < 1 second (with index)
- [ ] Upsert with deleteFilter is transactional
- [ ] No performance regression for existing operations

### Documentation

- [ ] Clear API documentation
- [ ] Complete guide with examples
- [ ] Migration guide for existing users

### Compatibility

- [ ] Backward compatible (no breaking changes)
- [ ] Works with existing code
- [ ] Graceful degradation for unsupported stores

---

## Risk Mitigation

### Risk 1: Breaking Changes

**Mitigation**: All new features are optional, existing code continues to work

### Risk 2: Performance Impact

**Mitigation**: Add indexes, benchmark before/after, provide optimization guide

### Risk 3: Transaction Safety

**Mitigation**: Thorough testing of transaction rollback scenarios

### Risk 4: Complex Filter Edge Cases

**Mitigation**: Comprehensive unit tests for filter combinations

---

## Post-Launch

### Week 6-7: Monitor & Iterate

- Monitor GitHub issues for problems
- Collect user feedback
- Add more examples based on common questions
- Performance tuning based on real usage

### Week 8+: Extended Features

- Batch operations API
- Soft delete (mark as deleted without removing)
- Audit trail for deletions
- Scheduled cleanup jobs

---

## Resource Requirements

### Development

- 1 senior engineer (full-time, 5 weeks)
- 1 engineer for code review

### Testing

- QA engineer (part-time, 2 weeks)
- Performance testing infrastructure

### Documentation

- Technical writer (part-time, 1 week)

---

## Checkpoints

### Checkpoint 1 (End of Week 2)

- ✅ Core PG implementation complete
- ✅ All unit tests passing
- ✅ Integration tests passing
- Decision: Proceed to Phase 2

### Checkpoint 2 (End of Week 3)

- ✅ RAG integration complete
- ✅ Documentation drafted
- ✅ Examples created
- Decision: Proceed to Phase 4

### Checkpoint 3 (End of Week 4)

- ✅ Other vector stores implemented
- ✅ Performance tests created
- Decision: Ready for release?

### Checkpoint 4 (End of Week 5)

- ✅ All tests passing
- ✅ Documentation complete
- ✅ Performance validated
- Decision: Ship it! 🚀

---

## Communication Plan

### Internal

- Weekly progress updates
- Demo at end of each phase
- Architecture review before Phase 1 start

### External

- Blog post announcing feature
- Tweet thread with examples
- Update changelog
- Community announcement

---

## Metrics to Track

### Development

- Lines of code added/changed
- Test coverage
- Number of tests
- Time to implement each phase

### Usage (Post-Launch)

- Adoption rate (% using new features)
- Most common filter patterns
- Performance metrics
- Error rates

---

## Conclusion

This implementation:

- Solves the user's problem completely
- Leverages existing infrastructure
- Maintains backward compatibility
- Provides clear value
- Has well-defined phases
- Includes comprehensive testing
- Has clear success criteria

**Estimated Total Time**: 5 weeks (1 senior engineer)
**Risk Level**: Low (leverages existing code, optional features)
**Value**: High (enables key RAG use cases)

Ready to proceed? 🚀
