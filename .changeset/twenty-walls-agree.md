---
'@mastra/core': patch
'@mastra/chroma': patch
'@mastra/duckdb': patch
'@mastra/elasticsearch': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/opensearch': patch
'@mastra/pg': patch
'@mastra/qdrant': patch
---

Added shared vector store test suite for consistent testing across all vector store implementations.

**What's new:**

- Introduced `createVectorTestSuite()` factory function that generates comprehensive tests for any vector store
- Added 151 shared tests across 6 domains: basic operations, filter operators, edge cases, error handling, metadata filtering, and advanced operations
- All 8 vector stores (Chroma, DuckDB, Elasticsearch, LibSQL, MongoDB, OpenSearch, PostgreSQL, Qdrant) now use the shared test suite
- Added capability flags to handle store-specific limitations (e.g., `supportsRegex`, `supportsNotOperator`, `supportsNorOperator`)

**Benefits:**

- 70% reduction in store-specific test code (-537 tests moved to shared suite)
- 69% increase in overall test coverage (+551 tests)
- Consistent behavior verification across all stores
- Easier onboarding for new vector store implementations

**Usage:**

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';

createVectorTestSuite({
  vector: myVectorStore,
  createIndex: async (indexName, options) => {
    await myVectorStore.createIndex({ indexName, dimension: 1536, metric: options?.metric });
  },
  deleteIndex: async (indexName) => {
    await myVectorStore.deleteIndex({ indexName });
  },
  // Optional capability flags for stores with limitations
  supportsRegex: false,
  supportsNotOperator: false,
});
```
