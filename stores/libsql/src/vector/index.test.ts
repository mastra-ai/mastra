import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createVectorTestSuite } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

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
  // LibSQL-specific: doesn't support $elemMatch
  supportsElemMatch: false,
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

describe('LibSQLVector local-file concurrency', () => {
  let tmpDir: string;
  let vectors: LibSQLVector[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-vector-concurrency-'));
    vectors = [];
  });

  afterEach(async () => {
    await Promise.all(vectors.map(vector => vector.close()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serializes concurrent index creation and preserves every write with a clean database', async () => {
    const dbPath = path.join(tmpDir, 'shared.db');
    const indexName = 'concurrent_vectors';
    const instanceCount = 12;
    vectors = Array.from(
      { length: instanceCount },
      (_, index) => new LibSQLVector({ id: `concurrent-${index}`, url: `file:${dbPath}` }),
    );

    await Promise.all(
      vectors.map(async (vector, index) => {
        await vector.createIndex({ indexName, dimension: 4 });
        await vector.upsert({
          indexName,
          ids: [`vector-${index}`],
          vectors: [[index + 1, 0, 0, 0]],
          metadata: [{ label: `write-${index}` }],
        });
      }),
    );

    await expect(vectors[0]!.describeIndex({ indexName })).resolves.toMatchObject({ count: instanceCount });

    const integrityClient = createClient({ url: `file:${dbPath}` });
    try {
      const records = await integrityClient.execute(`SELECT metadata FROM ${indexName}`);
      expect(new Set(records.rows.map(record => JSON.parse(record.metadata as string).label))).toEqual(
        new Set(Array.from({ length: instanceCount }, (_, index) => `write-${index}`)),
      );

      const integrity = await integrityClient.execute('PRAGMA integrity_check;');
      expect(integrity.rows).toHaveLength(1);
      expect(Object.values(integrity.rows[0]!)).toEqual(['ok']);
    } finally {
      integrityClient.close();
    }
  });

  it('canonicalizes relative, absolute, percent-encoded, and symlinked-parent file URLs to one queue', async () => {
    const realParent = path.join(tmpDir, 'real parent');
    const linkedParent = path.join(tmpDir, 'linked-parent');
    fs.mkdirSync(realParent);
    fs.symlinkSync(realParent, linkedParent, 'dir');

    const absolutePath = path.join(realParent, 'aliases.db');
    const relativePath = path.relative(process.cwd(), absolutePath);
    const encodedPath = absolutePath.replaceAll(' ', '%20');
    const linkedPath = path.join(linkedParent, 'aliases.db');
    const urls = [`file:${relativePath}`, `file:${absolutePath}`, `file:${encodedPath}`, `file:${linkedPath}`];
    vectors = urls.map((url, index) => new LibSQLVector({ id: `alias-${index}`, url }));

    await Promise.all(vectors.map(vector => vector.createIndex({ indexName: 'aliases', dimension: 2 })));
    await Promise.all(
      vectors.map((vector, index) =>
        vector.upsert({
          indexName: 'aliases',
          ids: [`alias-${index}`],
          vectors: [[index + 1, 0]],
          metadata: [{ spelling: index }],
        }),
      ),
    );

    await expect(vectors[0]!.describeIndex({ indexName: 'aliases' })).resolves.toMatchObject({ count: urls.length });
  });

  it('awaits initialization before a public operation touches the client', async () => {
    const vector = new LibSQLVector({ id: 'initialization-order', url: `file:${path.join(tmpDir, 'order.db')}` });
    vectors.push(vector);
    const internals = vector as unknown as {
      initialization: Promise<void>;
      turso: ReturnType<typeof createClient>;
    };
    await internals.initialization;

    let releaseInitialization!: () => void;
    internals.initialization = new Promise<void>(resolve => {
      releaseInitialization = resolve;
    });
    const executeSpy = vi.spyOn(internals.turso, 'execute');
    const operation = vector.listIndexes();

    await Promise.resolve();
    expect(executeSpy).not.toHaveBeenCalled();
    releaseInitialization();
    await expect(operation).resolves.toEqual([]);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});
