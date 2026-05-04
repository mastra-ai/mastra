import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  createIndex: async (indexName, options) => {
    await libSQLVectorDB.createIndex({ indexName, dimension: 1536, metric: options?.metric ?? 'cosine' });
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

  describe('DiskANN vector_top_k optimization', () => {
    const diskannIndexName = 'diskann_test';
    const tmpDir = path.join(os.tmpdir(), `libsql-diskann-test-${Date.now()}`);
    let fileDb: LibSQLVector;

    beforeAll(async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      fileDb = new LibSQLVector({
        url: `file:${path.join(tmpDir, 'test.db')}`,
        id: 'libsql-diskann-test',
      });

      await fileDb.createIndex({ indexName: diskannIndexName, dimension: 1536, metric: 'cosine' });

      await fileDb.upsert({
        indexName: diskannIndexName,
        vectors: [createVector(0), createVector(100), createVector(500), createVector(1000)],
        metadata: [
          { name: 'vec1', category: 'a' },
          { name: 'vec2', category: 'b' },
          { name: 'vec3', category: 'a' },
          { name: 'vec4', category: 'b' },
        ],
      });
    });

    afterAll(async () => {
      try {
        await fileDb.deleteIndex({ indexName: diskannIndexName });
      } catch {
        // Ignore cleanup errors
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return correct results using indexed query', async () => {
      const results = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 10,
      });

      expect(results.length).toBe(4);
      expect(results[0]!.metadata.name).toBe('vec1');
      expect(results[0]!.score).toBeCloseTo(1, 5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
      }
    });

    it('should respect topK limit with indexed query', async () => {
      const results = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 2,
      });

      expect(results.length).toBe(2);
    });

    it('should filter by metadata with indexed query', async () => {
      const results = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 10,
        filter: { category: { $eq: 'a' } },
      });

      expect(results.length).toBe(2);
      results.forEach(r => {
        expect(r.metadata.category).toBe('a');
      });
    });

    it('should respect minScore with indexed query', async () => {
      const allResults = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 10,
      });

      const scores = allResults.map(r => r.score).sort((a, b) => b - a);
      const threshold = (scores[0]! + scores[1]!) / 2;

      const filtered = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 10,
        minScore: threshold,
      });

      expect(filtered.length).toBeLessThan(allResults.length);
      filtered.forEach(r => {
        expect(r.score).toBeGreaterThan(threshold);
      });
    });

    it('should include vectors when requested with indexed query', async () => {
      const results = await fileDb.query({
        indexName: diskannIndexName,
        queryVector: createVector(0),
        topK: 1,
        includeVector: true,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.vector).toBeDefined();
      expect(Array.isArray(results[0]!.vector)).toBe(true);
      expect(results[0]!.vector!.length).toBe(1536);
    });

    it('should actually use vector_top_k in the query', async () => {
      const turso = (fileDb as any).turso;
      const originalExecute = turso.execute.bind(turso);
      const executedQueries: string[] = [];
      turso.execute = async (arg: any) => {
        if (typeof arg === 'object' && arg.sql) executedQueries.push(arg.sql);
        return originalExecute(arg);
      };

      try {
        await fileDb.query({
          indexName: diskannIndexName,
          queryVector: createVector(0),
          topK: 5,
        });
      } finally {
        turso.execute = originalExecute;
      }

      const usedVectorTopK = executedQueries.some(sql => sql.includes('vector_top_k'));
      expect(usedVectorTopK).toBe(true);
    });
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
