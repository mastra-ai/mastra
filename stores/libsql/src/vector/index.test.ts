import { createVectorTestSuite } from '@internal/storage-test-utils';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { LibSQLVector } from './index.js';

const libSQLVectorDB = new LibSQLVector({
  url: 'file::memory:?cache=shared',
  id: 'libsql-shared-test',
});

// Shared test suite
createVectorTestSuite({
  vector: libSQLVectorDB,
  createIndex: async (indexName: string) => {
    await libSQLVectorDB.createIndex({ indexName, dimension: 1536, metric: 'cosine' });
  },
  deleteIndex: async (indexName: string) => {
    try {
      await libSQLVectorDB.deleteIndex({ indexName });
    } catch (error) {
      console.error(`Error deleting index ${indexName}:`, error);
    }
  },
  waitForIndexing: async () => {},
  testDomains: {
    largeBatch: false,
  },
  supportsRegex: false,
  supportsContains: false,
  // LibSQL-specific: validates and rejects empty $not (stricter than other stores)
  supportsNotOperator: false,
  // LibSQL-specific: validates and rejects $nor operator
  supportsNorOperator: false,
  // LibSQL-specific: doesn't support $elemMatch or $size operators
  supportsElemMatch: false,
  supportsSize: false,
  // LibSQL-specific: silently handles malformed operators (returns empty results instead of throwing)
  supportsStrictOperatorValidation: false,
});

// LibSQL-specific tests for features not in the shared interface
describe('LibSQLVector - Store Specific', () => {
  const testIndexName = `libsql_specific_test_${Date.now()}`;

  // Helper to create test vectors
  const createVector = (seed: number): number[] => {
    const vector = new Array(1536).fill(0);
    vector[seed % 1536] = 1;
    return vector;
  };

  beforeAll(async () => {
    await libSQLVectorDB.createIndex({ indexName: testIndexName, dimension: 1536, metric: 'cosine' });

    // Insert test vectors with varying similarity to a reference vector
    await libSQLVectorDB.upsert({
      indexName: testIndexName,
      vectors: [
        createVector(0), // Will have high similarity to query vector createVector(0)
        createVector(100), // Lower similarity
        createVector(500), // Even lower similarity
        createVector(1000), // Low similarity
      ],
      metadata: [{ name: 'vec1' }, { name: 'vec2' }, { name: 'vec3' }, { name: 'vec4' }],
    });
  });

  afterAll(async () => {
    try {
      await libSQLVectorDB.deleteIndex({ indexName: testIndexName });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('minScore parameter', () => {
    it('should respect minimum score threshold', async () => {
      // First query without minScore to get all results
      const allResults = await libSQLVectorDB.query({
        indexName: testIndexName,
        queryVector: createVector(0),
        topK: 10,
      });

      expect(allResults.length).toBe(4);

      // Get scores and find a threshold that will filter some out
      const scores = allResults.map(r => r.score).sort((a, b) => b - a);
      // Use a score between the highest and second highest to filter
      const threshold = (scores[0]! + scores[1]!) / 2;

      // Query with minScore
      const filteredResults = await libSQLVectorDB.query({
        indexName: testIndexName,
        queryVector: createVector(0),
        topK: 10,
        minScore: threshold,
      });

      // Should return fewer results
      expect(filteredResults.length).toBeLessThan(allResults.length);

      // All returned results should have score >= threshold
      filteredResults.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(threshold);
      });
    });

    it('should return all results when minScore is very low', async () => {
      const results = await libSQLVectorDB.query({
        indexName: testIndexName,
        queryVector: createVector(0),
        topK: 10,
        minScore: -1, // Cosine similarity ranges from -1 to 1
      });

      // Should return all 4 vectors
      expect(results.length).toBe(4);
    });

    it('should return no results when minScore is impossibly high', async () => {
      const results = await libSQLVectorDB.query({
        indexName: testIndexName,
        queryVector: createVector(0),
        topK: 10,
        minScore: 2, // Cosine similarity max is 1, so nothing can match
      });

      expect(results.length).toBe(0);
    });
  });
});
