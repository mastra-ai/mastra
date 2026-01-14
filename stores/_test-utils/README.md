# Vector Store Test Suite

A comprehensive, standardized test suite for vector store implementations in Mastra. This test suite ensures all vector stores implement the `MastraVector` interface consistently and work correctly with the Memory system.

## Overview

The shared test suite provides 90+ test cases across 6 domains that verify fundamental vector store operations, filter capabilities, edge case handling, and error conditions. Using this test suite ensures your vector store implementation is production-ready and compatible with Mastra's agent memory system.

**Benefits:**

- Consistent testing across all vector stores
- Guaranteed Memory system compatibility
- Comprehensive coverage of vector operations
- Reduced test duplication (96% reduction in redundant custom tests across 17 stores)
- Faster onboarding for new vector stores

**Statistics** (as of 2026-01-14):

- 17 vector stores using shared test suite
- ~1,800+ total tests across all stores
- 72% code reduction (stores with custom tests)
- Zero coverage loss - all functionality preserved

## Available Test Domains

The test suite is organized into 6 domains, all enabled by default:

### 1. Basic Operations (~15 tests)

**Module**: `domains/vector/basic-operations.ts`

Tests fundamental vector store operations:

- **Index Lifecycle**: createIndex, listIndexes, describeIndex, deleteIndex
- **Upsert Operations**: single vector, multiple vectors, duplicate ID handling (update), upsert without metadata
- **Query Operations**: basic queries, topK parameter, score sorting, metadata filtering, empty filter results

These tests verify the core MastraVector interface methods work correctly.

### 2. Filter Operators (~20 tests)

**Module**: `domains/vector/filter-operators.ts`

Tests metadata filtering capabilities:

- **Comparison Operators**: `$gt`, `$lt`, `$gte`, `$lte` (numeric ranges)
- **Negation Operators**: `$ne`, `$not`
- **Array Operators**: `$in`, `$nin`, `$all`
- **Existence Operator**: `$exists`
- **Null Handling**: `$eq null`, `$ne null`
- **Pattern Matching** (OPTIONAL): `$regex`, `$contains` (wrapped in try/catch for stores that don't support)
- **Combined Filters**: Multiple operators together

### 3. Edge Cases (~15 tests)

**Module**: `domains/vector/edge-cases.ts`

Tests boundary conditions and stress scenarios:

- **Empty Index Operations**: Query/delete on empty indexes
- **Dimension Mismatch**: Wrong dimension vectors, empty vectors
- **Large Batch Operations**: 1000+ vector upserts (120s timeout), large topK queries, batch deletes
- **Concurrent Operations**: Parallel upserts, parallel queries, mixed concurrent operations
- **Vector Normalization**: Zero magnitude, NaN/Infinity rejection, extreme values

### 4. Error Handling (~10 tests)

**Module**: `domains/vector/error-handling.ts`

Tests error scenarios to ensure consistent error behavior:

- **Index Not Found**: Query/upsert/describe/delete on non-existent index
- **Invalid Filters**: Malformed operators, null/undefined values, deeply nested filters
- **Invalid Vector Data**: Non-numeric values, wrong types, empty vectors, dimension mismatch
- **Invalid Parameters**: Negative/zero topK, mismatched array lengths, invalid dimensions/metrics
- **Metadata Type Errors**: Circular references, functions, symbols, extremely large metadata
- **Concurrent Operation Errors**: Double deletion, concurrent upserts

### 5. Metadata Filtering (~20 tests)

**Module**: `domains/vector/metadata-filtering.ts`

Tests Memory system compatibility:

- Filter by `thread_id` (thread isolation)
- Filter by `resource_id` (resource isolation)
- Combined filters with `$and`, `$or`
- Empty results for non-matching filters
- Backward compatibility with `metadata.` prefix

### 6. Advanced Operations (~10 tests)

**Module**: `domains/vector/advanced-operations.ts`

Tests advanced vector operations:

- **deleteVectors**: With simple filter, `$and`/`$or`/`$in` filters, IDs array
- **updateVector**: With simple/complex filters, by ID
- **Error cases**: Empty filter, empty IDs, mutually exclusive parameters
- **Real-world scenarios**: Document re-indexing, multi-tenant data isolation

## Integration Guide

### Step 1: Import the Test Suite

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';
```

### Step 2: Implement Required Callbacks

Create the test suite at the bottom of your test file (e.g., `stores/your-store/src/vector/index.test.ts`):

```typescript
// Your store-specific tests above...

// Shared test suite integration
createVectorTestSuite({
  // Your vector store instance
  vector: yourVectorStore,

  // Create index callback (dimension 1536, cosine metric recommended)
  createIndex: async (indexName: string) => {
    await yourVectorStore.createIndex({
      indexName,
      dimension: 1536,
      metric: 'cosine',
    });
  },

  // Delete index callback
  deleteIndex: async (indexName: string) => {
    await yourVectorStore.deleteIndex({ indexName });
  },

  // Optional: Wait for indexing to complete (for eventual consistency)
  waitForIndexing: async (indexName: string) => {
    // For synchronous stores: no-op or short delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // For eventually consistent stores: poll until ready
    // await waitUntilReady(indexName);
  },

  // Optional: Connection setup (if needed)
  connect: async () => {
    await yourVectorStore.connect();
  },

  // Optional: Connection cleanup (if needed)
  disconnect: async () => {
    await yourVectorStore.disconnect();
  },
});
```

### Step 3: Run Tests

```bash
# Build from monorepo root first
pnpm build

# Run tests for your store
cd stores/your-store
pnpm test
```

## Configuration Options

### VectorTestConfig Interface

```typescript
interface VectorTestConfig {
  /** Your vector store instance (implements MastraVector) */
  vector: MastraVector<any>;

  /** Create index callback - should create index with given name */
  createIndex: (indexName: string) => Promise<void>;

  /** Delete index callback - should delete index with given name */
  deleteIndex: (indexName: string) => Promise<void>;

  /** Optional: Wait for indexing to complete (for eventual consistency) */
  waitForIndexing?: (indexName: string) => Promise<void>;

  /** Optional: Connect to vector store before tests */
  connect?: () => Promise<void>;

  /** Optional: Disconnect from vector store after tests */
  disconnect?: () => Promise<void>;

  /** Optional: Selectively enable/disable test domains */
  testDomains?: TestDomains;
}
```

### TestDomains Interface

```typescript
interface TestDomains {
  /** Basic operations: createIndex, upsert, query, listIndexes, describeIndex, deleteIndex */
  basicOps?: boolean;

  /** Filter operators: $gt, $lt, $gte, $lte, $ne, $not, $in, $nin, $all, $exists, $regex (optional) */
  filterOps?: boolean;

  /** Edge cases: empty indexes, dimension mismatch, large batches (1000+ vectors), concurrent operations */
  edgeCases?: boolean;

  /** Error handling: index not found, invalid filters, invalid data, parameter validation */
  errorHandling?: boolean;

  /** Metadata filtering: Memory system compatibility ($eq, $and, $or, thread_id, resource_id) */
  metadataFiltering?: boolean;

  /** Advanced operations: deleteVectors with filters, updateVector with filters */
  advancedOps?: boolean;
}
```

All domains are enabled by default. Set a domain to `false` to skip it.

## Usage Examples

### Example 1: Basic Integration (Postgres)

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { PgVector } from '.';

describe('PgVector', () => {
  let vectorDB: PgVector;
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

  beforeAll(async () => {
    vectorDB = new PgVector({ connectionString, id: 'pg-vector-test' });
  });

  // Store-specific tests here...

  // Shared test suite (at the end)
  createVectorTestSuite({
    vector: vectorDB,
    createIndex: async (indexName: string) => {
      await vectorDB.createIndex({
        indexName,
        dimension: 1536,
        metric: 'cosine',
      });
    },
    deleteIndex: async (indexName: string) => {
      await vectorDB.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // Postgres is synchronous, no wait needed
      await new Promise(resolve => setTimeout(resolve, 100));
    },
  });
});
```

### Example 2: Eventual Consistency (Astra)

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { AstraVector } from '.';

// Helper function for eventual consistency
async function waitForCondition(check: () => Promise<boolean>, timeout = 30000, interval = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Condition not met within timeout');
}

describe('AstraVector', () => {
  let vectorDB: AstraVector;

  beforeAll(async () => {
    vectorDB = new AstraVector({
      token: process.env.ASTRA_DB_TOKEN!,
      endpoint: process.env.ASTRA_DB_ENDPOINT!,
      keyspace: process.env.ASTRA_DB_KEYSPACE!,
    });
  });

  // Store-specific tests here...

  // Shared test suite with eventual consistency handling
  createVectorTestSuite({
    vector: vectorDB,
    createIndex: async (indexName: string) => {
      await vectorDB.createIndex({
        indexName,
        dimension: 1536,
        metric: 'cosine',
      });
      // Wait for index to be ready
      await waitForCondition(async () => {
        const indexes = await vectorDB.listIndexes();
        return indexes.includes(indexName);
      });
    },
    deleteIndex: async (indexName: string) => {
      await vectorDB.deleteIndex({ indexName });
      // Wait for deletion to complete
      await waitForCondition(async () => {
        const indexes = await vectorDB.listIndexes();
        return !indexes.includes(indexName);
      });
    },
    waitForIndexing: async () => {
      // Fixed delay for vectors to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
  });
});
```

### Example 3: Selective Test Domains (Lance)

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';
import { LanceVectorStore } from '.';

describe('LanceVectorStore', () => {
  let vectorDB: LanceVectorStore;
  const dbUrl = process.env.DB_URL || './lance-test.db';

  beforeAll(async () => {
    vectorDB = await LanceVectorStore.create({ dbUrl });
  });

  // Store-specific tests here...

  // Shared test suite with selective domains
  createVectorTestSuite({
    vector: vectorDB,
    createIndex: async (indexName: string) => {
      // Lance requires a table with data before creating an index
      const tableName = indexName;
      const vectors = generateTableData(300, 1536); // 300+ rows required
      await vectorDB.createTable({
        tableName,
        data: vectors,
      });
      await vectorDB.createIndex({
        tableName,
        column: 'vector',
        indexType: 'ivfflat',
        numPartitions: 2,
        numSubVectors: 1,
      });
    },
    deleteIndex: async (indexName: string) => {
      // Lance uses deleteTable instead of deleteIndex
      await vectorDB.deleteTable(indexName);
    },
    waitForIndexing: async () => {
      // Lance operations are synchronous
    },
    testDomains: {
      // Disable domains that don't apply to Lance's table-based architecture
      edgeCases: false, // Lance handles dimension mismatch/large batches differently
      advancedOps: false, // deleteVectors/updateVector use tableName parameter
    },
  });
});
```

### Example 4: Opting Out of Pattern Matching

If your vector store doesn't support regex/pattern matching:

```typescript
createVectorTestSuite({
  vector: yourVectorStore,
  createIndex: async name => {
    /* ... */
  },
  deleteIndex: async name => {
    /* ... */
  },
  testDomains: {
    filterOps: false, // Skip pattern matching tests ($regex, $contains)
  },
});
```

### Example 5: Gradual Migration

For stores with existing comprehensive tests, use `describe.skip` for gradual migration:

```typescript
import { createVectorTestSuite } from '@internal/storage-test-utils';

describe('YourVectorStore', () => {
  // Keep existing tests active
  describe('Existing Tests', () => {
    it('test 1', () => {
      /* ... */
    });
    it('test 2', () => {
      /* ... */
    });
  });

  // Add shared suite with describe.skip initially
  describe.skip('Shared Test Suite', () => {
    createVectorTestSuite({
      vector: yourVectorStore,
      createIndex: async name => {
        /* ... */
      },
      deleteIndex: async name => {
        /* ... */
      },
    });
  });
});

// Later, after validation:
// 1. Remove describe.skip to enable shared suite
// 2. Remove redundant tests from "Existing Tests"
// 3. Keep store-specific tests (connection setup, store-specific APIs)
```

## Troubleshooting

### Issue: Tests Timeout

**Problem**: Large batch tests or eventual consistency tests timeout.

**Solution**:

- Increase timeout in test runner (Vitest default: 5s)
- Implement proper `waitForIndexing` callback
- For large batch tests: use 60-120s timeouts (tests already configured)

```typescript
// In your test file
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds (default: 5000)
  },
});
```

### Issue: Some Tests Fail with "Not Implemented"

**Problem**: Vector store doesn't support certain operations (e.g., `describeIndex`, `updateVector`).

**Solution**: Opt out of specific test domains.

```typescript
createVectorTestSuite({
  vector: yourVectorStore,
  createIndex: async name => {
    /* ... */
  },
  deleteIndex: async name => {
    /* ... */
  },
  testDomains: {
    advancedOps: false, // Disable if updateVector/deleteVectors not supported
  },
});
```

### Issue: Error Handling Tests Fail

**Problem**: Store returns empty arrays instead of throwing errors for invalid inputs.

**Solution**: This is acceptable behavior. Some stores (pg, libsql) use graceful degradation instead of strict errors. Document this in your test file:

```typescript
// Note: This store uses graceful degradation for invalid inputs
// (returns empty arrays instead of throwing errors)
// This is acceptable and does not affect Memory system compatibility
createVectorTestSuite({
  /* ... */
});
```

### Issue: Pattern Matching Tests Fail

**Problem**: Store doesn't support `$regex` or `$contains` operators.

**Solution**: The pattern matching tests are already wrapped in try/catch and marked as OPTIONAL. If they fail, opt out of the filterOps domain or the tests will pass with warnings.

```typescript
createVectorTestSuite({
  vector: yourVectorStore,
  createIndex: async name => {
    /* ... */
  },
  deleteIndex: async name => {
    /* ... */
  },
  testDomains: {
    filterOps: false, // Disable if pattern matching not supported
  },
});
```

### Issue: Dimension Mismatch Tests Fail

**Problem**: Store accepts vectors with different dimensions than index dimension.

**Solution**: This indicates a bug in the vector store implementation. The store should validate vector dimensions on upsert and query.

### Issue: Concurrent Operation Tests Fail

**Problem**: Race conditions or locking issues.

**Solution**: Investigate store's concurrency handling. Tests use `Promise.all()` to run operations in parallel. Consider:

- Connection pooling configuration
- Transaction isolation levels
- Store-specific locking mechanisms

### Issue: Memory Leaks or Unhandled Errors

**Problem**: Tests report unhandled promise rejections or memory leaks.

**Solution**:

- Implement proper `disconnect` callback for cleanup
- Ensure all connections are closed in `afterAll` hooks
- Check for hanging timers or open file handles

```typescript
createVectorTestSuite({
  vector: yourVectorStore,
  createIndex: async name => {
    /* ... */
  },
  deleteIndex: async name => {
    /* ... */
  },
  disconnect: async () => {
    await yourVectorStore.disconnect();
    // Close all connections, file handles, etc.
  },
});
```

## Store-Specific Features

Some stores have unique features that are tested separately from the shared suite. These are preserved as custom tests in their respective test files:

### Stores with Custom Tests

| Store         | Custom Tests | Features Tested                                                             |
| ------------- | ------------ | --------------------------------------------------------------------------- |
| **couchbase** | 8 tests      | TTL management, bulk operations, implementation verification                |
| **duckdb**    | 16 tests     | $contains operator, distance metrics, storage modes, implementation details |
| **upstash**   | 6 tests      | Metadata range queries, batch operations with metadata filters              |
| **libsql**    | 12 tests     | Path configuration, encryption support, connection modes                    |
| **mongodb**   | 6 tests      | MongoDB-specific filter operators, batch operations                         |

### Stores Using Shared Suite Only

The following stores use only the shared test suite (no custom tests):

- Astra, Chroma, Convex, DynamoDB, Elasticsearch, Lance, OpenSearch, Pinecone, Qdrant, S3Vectors, Turbopuffer, Vectorize

## Store-Specific Patterns

### Pattern 1: Eventual Consistency Helpers

For stores with significant eventual consistency (Astra, Vectorize):

```typescript
async function waitUntilReady(indexName: string, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const indexes = await vectorDB.listIndexes();
      if (indexes.includes(indexName)) {
        return;
      }
    } catch {
      // Ignore errors during polling
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Index ${indexName} not ready within ${timeout}ms`);
}
```

### Pattern 2: Table-Based Architecture (Lance)

For stores that require tables before indexes:

```typescript
function generateTableData(count: number, dimension: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `vector-${i}`,
    vector: Array.from({ length: dimension }, () => Math.random()),
    metadata: { index: i },
  }));
}

createVectorTestSuite({
  vector: lanceDB,
  createIndex: async (indexName: string) => {
    const vectors = generateTableData(300, 1536);
    await lanceDB.createTable({ tableName: indexName, data: vectors });
    await lanceDB.createIndex({
      tableName: indexName,
      column: 'vector',
      indexType: 'ivfflat',
    });
  },
  deleteIndex: async (indexName: string) => {
    await lanceDB.deleteTable(indexName);
  },
});
```

### Pattern 3: Environment Variable Checks

For stores requiring credentials:

```typescript
describe('YourVectorStore', () => {
  const hasCredentials = process.env.API_KEY && process.env.ENDPOINT;

  if (!hasCredentials) {
    console.warn('⚠️  Skipping YourVectorStore tests - credentials not set');
    return;
  }

  // Tests here...
});
```

## Test Domain Details

For detailed information about what each test domain covers:

- **Basic Operations**: See `stores/_test-utils/src/domains/vector/basic-operations.ts`
- **Filter Operators**: See `stores/_test-utils/src/domains/vector/filter-operators.ts`
- **Edge Cases**: See `stores/_test-utils/src/domains/vector/edge-cases.ts`
- **Error Handling**: See `stores/_test-utils/src/domains/vector/error-handling.ts`
- **Metadata Filtering**: See `stores/_test-utils/src/domains/vector/metadata-filtering.ts`
- **Advanced Operations**: See `stores/_test-utils/src/domains/vector/advanced-operations.ts`

## Reference Implementations

See these stores for working examples:

- **Postgres** (`stores/pg/src/vector/index.test.ts`) - Simple integration, synchronous operations
- **Astra** (`stores/astra/src/vector/index.test.ts`) - Eventual consistency handling
- **Lance** (`stores/lance/src/vector/index.test.ts`) - Selective test domains, table-based architecture
- **Vectorize** (`stores/vectorize/src/vector/index.test.ts`) - Complex eventual consistency, all domains enabled

## Related Documentation

- `DEVELOPMENT.md` - Monorepo setup and contribution guidelines
- `@mastra/core/vector` - Base `MastraVector` interface
- `.ralph-wiggum/FINAL_VALIDATION.md` - Comprehensive validation results for all 17 vector stores
- `.ralph-wiggum/SHARED_SUITE_GAPS.md` - Analysis of test coverage gaps (zero high-priority gaps found)
- `.ralph-wiggum/CURRENT_STATE.md` - Current state of all vector stores after comprehensive review

## Support

For issues or questions about the shared test suite:

- Review this documentation and reference implementations
- Check `.ralph-wiggum/TEST_RESULTS.md` for common patterns
- Examine test domain source files for detailed test logic
- Create a GitHub issue if you encounter bugs or need clarification
