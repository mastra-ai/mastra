import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraVector } from '@mastra/core/vector';
import { createMetadataFilteringTest } from './domains/vector/metadata-filtering';
import { createAdvancedOperationsTest } from './domains/vector/advanced-operations';
import { createBasicOperationsTest } from './domains/vector/basic-operations';
import { createFilterOperatorsTest } from './domains/vector/filter-operators';
import { createEdgeCasesTest } from './domains/vector/edge-cases';
import { createErrorHandlingTest } from './domains/vector/error-handling';

/**
 * Configuration for selective test domain execution.
 * By default, all test domains are enabled. Set a domain to false to skip it.
 *
 * @example
 * ```typescript
 * // Run all tests (default)
 * createVectorTestSuite({ vector, createIndex, deleteIndex });
 *
 * // Skip pattern matching tests if store doesn't support regex
 * createVectorTestSuite({
 *   vector,
 *   createIndex,
 *   deleteIndex,
 *   testDomains: {
 *     filterOps: false, // Skip if regex/pattern matching not supported
 *   }
 * });
 *
 * // Skip large batch tests for stores with strict rate limits
 * createVectorTestSuite({
 *   vector,
 *   createIndex,
 *   deleteIndex,
 *   testDomains: {
 *     edgeCases: false,
 *   }
 * });
 * ```
 */
export interface TestDomains {
  /** Basic operations: createIndex, upsert, query, listIndexes, describeIndex, deleteIndex */
  basicOps?: boolean;
  /** Filter operators: $gt, $lt, $gte, $lte, $ne, $not, $in, $nin, $all, $exists, $regex (optional) */
  filterOps?: boolean;
  /** Edge cases: empty indexes, dimension mismatch, large batches (1000+ vectors), concurrent operations */
  edgeCases?: boolean;
  /** Large batch operations: 1000+ vector upserts, large topK queries. Subset of edgeCases, can be disabled separately. */
  largeBatch?: boolean;
  /** Error handling: index not found, invalid filters, invalid data, parameter validation */
  errorHandling?: boolean;
  /** Metadata filtering: Memory system compatibility ($eq, $and, $or, thread_id, resource_id) */
  metadataFiltering?: boolean;
  /** Advanced operations: deleteVectors with filters, updateVector with filters */
  advancedOps?: boolean;
}

export interface VectorTestConfig {
  vector: MastraVector<any>;
  createIndex: (indexName: string) => Promise<void>;
  deleteIndex: (indexName: string) => Promise<void>;
  waitForIndexing?: (indexName: string) => Promise<void>;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  /** Optional: selectively enable/disable test domains. All enabled by default. */
  testDomains?: TestDomains;
  /** Whether the store supports array values in metadata. Default: true.
   *  Set to false for stores like Chroma that only support primitive types (string, number, boolean).
   *  When false, filter-operators tests will skip array-specific tests ($all, $in on array fields)
   *  but still run all other filter operator tests. */
  supportsArrayMetadata?: boolean;
  /** Whether the store supports null values in filters. Default: true.
   *  Set to false for stores that don't support filtering by null (e.g., Chroma). */
  supportsNullValues?: boolean;
  /** Whether the store supports the $exists operator. Default: true.
   *  Set to false for stores that don't support checking field existence. */
  supportsExistsOperator?: boolean;
  /** Whether the store supports the $regex operator. Default: true.
   *  Set to false for stores that don't support regex pattern matching. */
  supportsRegex?: boolean;
  /** Whether the store supports the $contains operator for substring matching. Default: true.
   *  Set to false for stores that don't support substring matching. */
  supportsContains?: boolean;
  /** Whether the store supports the $not operator for logical negation. Default: true.
   *  Set to false for stores that don't support $not. */
  supportsNotOperator?: boolean;
  /** Whether the store supports the $nor operator for "not or" logical operations. Default: true.
   *  Set to false for stores that don't support $nor. */
  supportsNorOperator?: boolean;
  /** Whether the store supports the $elemMatch operator for array element matching. Default: true.
   *  Set to false for stores that don't support $elemMatch. */
  supportsElemMatch?: boolean;
  /** Whether the store supports the $size operator for array length filtering. Default: true.
   *  Set to false for stores that don't support $size. */
  supportsSize?: boolean;
  /** Whether the store throws errors for malformed operator syntax. Default: true.
   *  Set to false for stores that silently handle malformed operators (e.g., return empty results). */
  supportsStrictOperatorValidation?: boolean;
  /** Whether the store allows empty $not operator (matches all documents). Default: false.
   *  Most stores using the core filter translator reject empty $not by design.
   *  Set to true only for stores that allow empty $not and treat it as matching all. */
  supportsEmptyNot?: boolean;
  /** Whether the store allows empty logical operators ($and, $or). Default: true.
   *  Set to false for stores that throw validation errors on empty logical operators. */
  supportsEmptyLogicalOperators?: boolean;
}

/**
 * Creates a comprehensive test suite for vector stores.
 * This function generates tests across multiple domains to ensure consistent behavior.
 *
 * @param config - Vector test configuration including store instance and lifecycle hooks
 *
 * @remarks
 * The test suite includes 6 domains (all enabled by default):
 * 1. Basic Operations - Index lifecycle, upsert, query (14 tests)
 * 2. Filter Operators - Comparison, negation, pattern matching (25+ tests)
 * 3. Edge Cases - Empty indexes, large batches, concurrent operations (17 tests)
 * 4. Error Handling - Invalid inputs, parameter validation (30+ tests)
 * 5. Metadata Filtering - Memory system compatibility (existing)
 * 6. Advanced Operations - deleteVectors/updateVector with filters (existing)
 *
 * Total: 90+ comprehensive test cases
 *
 * @example
 * ```typescript
 * // Full test suite (all domains)
 * createVectorTestSuite({
 *   vector: pgVector,
 *   createIndex: async (name) => { await pgVector.createIndex({ indexName: name, dimension: 1536 }); },
 *   deleteIndex: async (name) => { await pgVector.deleteIndex({ indexName: name }); },
 *   waitForIndexing: async () => { await new Promise(r => setTimeout(r, 100)); }
 * });
 *
 * // Selective domains (skip regex tests for stores without pattern matching)
 * createVectorTestSuite({
 *   vector: astraVector,
 *   createIndex: async (name) => { /* ... *\/ },
 *   deleteIndex: async (name) => { /* ... *\/ },
 *   testDomains: {
 *     filterOps: false, // Skip if $regex not supported
 *   }
 * });
 * ```
 */
export function createVectorTestSuite(config: VectorTestConfig) {
  const { connect, disconnect, testDomains = {} } = config;

  // Get the vector store name, handling cases where vector might be a getter or null initially
  let vectorName = 'VectorStore';
  try {
    const vector = config.vector;
    if (vector && vector.constructor) {
      vectorName = vector.constructor.name;
    }
  } catch (e) {
    // If accessing vector throws (e.g., it's undefined), use default name
  }

  describe(vectorName, () => {
    beforeAll(
      async () => {
        if (connect) {
          const start = Date.now();
          console.log('Connecting to vector store...');
          await connect();
          const end = Date.now();
          console.log(`Vector store connected in ${end - start}ms`);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes timeout for Docker setup

    afterAll(async () => {
      if (disconnect) {
        await disconnect();
      }
    }, 60 * 1000); // 1 minute timeout for cleanup

    // Run test domains (all enabled by default, can be selectively disabled)
    if (testDomains.basicOps !== false) {
      createBasicOperationsTest(config);
    }

    if (testDomains.filterOps !== false) {
      createFilterOperatorsTest(config);
    }

    if (testDomains.edgeCases !== false) {
      createEdgeCasesTest(config, { skipLargeBatch: testDomains.largeBatch === false });
    }

    if (testDomains.errorHandling !== false) {
      createErrorHandlingTest(config);
    }

    if (testDomains.metadataFiltering !== false) {
      createMetadataFilteringTest(config);
    }

    if (testDomains.advancedOps !== false) {
      createAdvancedOperationsTest(config);
    }
  });
}
