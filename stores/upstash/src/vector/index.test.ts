import type { QueryResult } from '@mastra/core/vector';
import dotenv from 'dotenv';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';

import { UpstashVector } from './';

dotenv.config();

function waitUntilVectorsIndexed(vector: UpstashVector, indexName: string, expectedCount: number) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30;
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const stats = await vector.describeIndex(indexName);
        if (stats && stats.count >= expectedCount) {
          clearInterval(interval);
          resolve(true);
        }
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for vectors to be indexed'));
        }
      } catch (error) {
        console.log(error);
      }
    }, 5000);
  });
}

/**
 * These tests require a real Upstash Vector instance since there is no local Docker alternative.
 * The tests will be skipped in local development where Upstash credentials are not available.
 * In CI/CD environments, these tests will run using the provided Upstash Vector credentials.
 */
describe.skipIf(!process.env.UPSTASH_VECTOR_URL || !process.env.UPSTASH_VECTOR_TOKEN)('UpstashVector', () => {
  let vectorStore: UpstashVector;
  const VECTOR_DIMENSION = 1536;
  const testIndexName = 'default';
  const filterIndexName = 'filter-index';

  beforeAll(() => {
    // Load from environment variables for CI/CD
    const url = process.env.UPSTASH_VECTOR_URL;
    const token = process.env.UPSTASH_VECTOR_TOKEN;

    if (!url || !token) {
      console.log('Skipping Upstash Vector tests - no credentials available');
      return;
    }

    vectorStore = new UpstashVector({ url, token });
  });

  afterAll(async () => {
    if (!vectorStore) return;

    // Cleanup: delete test index
    try {
      await vectorStore.deleteIndex(testIndexName);
    } catch (error) {
      console.warn('Failed to delete test index:', error);
    }
    try {
      await vectorStore.deleteIndex(filterIndexName);
    } catch (error) {
      console.warn('Failed to delete filter index:', error);
    }
  });

  describe('Vector Operations', () => {
    // Helper function to create a normalized vector
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };

    let vectorIds: string[];

    it('should upsert vectors and query them', async () => {
      // Create and log test vectors
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testMetadata = [{ label: 'first-dimension' }, { label: 'second-dimension' }, { label: 'third-dimension' }];

      // Upsert vectors
      vectorIds = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors, metadata: testMetadata });

      expect(vectorIds).toHaveLength(3);
      await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

      const results = await vectorStore.query({ indexName: testIndexName, queryVector: createVector(0, 0.9), topK: 3 });

      expect(results).toHaveLength(3);
      if (results.length > 0) {
        expect(results?.[0]?.metadata).toEqual({ label: 'first-dimension' });
      }
    }, 5000000);

    it('should query vectors and return vector in results', async () => {
      const results = await vectorStore.query({
        indexName: testIndexName,
        queryVector: createVector(0, 0.9),
        topK: 3,
        includeVector: true,
      });
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.vector).toBeDefined();
        expect(result.vector).toHaveLength(VECTOR_DIMENSION);
      });
    });

    describe('Vector update operations', () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      const testIndexName = 'test-index';

      afterEach(async () => {
        await vectorStore.deleteIndex(testIndexName);
      });

      it('should update the vector by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);
        const newMetaData = {
          test: 'updates',
        };

        const update = {
          vector: newVector,
          metadata: newMetaData,
        };

        await vectorStore.updateIndexById(testIndexName, idToBeUpdated, update);

        await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
        expect(results[0]?.metadata).toEqual(newMetaData);
      }, 500000);

      it('should only update the metadata by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const newMetaData = {
          test: 'updates',
        };

        const update = {
          metadata: newMetaData,
        };

        await expect(vectorStore.updateIndexById(testIndexName, 'id', update)).rejects.toThrow(
          'Both vector and metadata must be provided for an update',
        );
      });

      it('should only update vector embeddings by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);

        const idToBeUpdated = ids[0];
        const newVector = createVector(0, 4.0);

        const update = {
          vector: newVector,
        };

        await vectorStore.updateIndexById(testIndexName, idToBeUpdated, update);

        await waitUntilVectorsIndexed(vectorStore, testIndexName, 3);

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: newVector,
          topK: 2,
          includeVector: true,
        });
        expect(results[0]?.id).toBe(idToBeUpdated);
        expect(results[0]?.vector).toEqual(newVector);
      }, 500000);

      it('should throw exception when no updates are given', async () => {
        await expect(vectorStore.updateIndexById(testIndexName, 'id', {})).rejects.toThrow('No update data provided');
      });
    });

    describe('Vector delete operations', () => {
      const testVectors = [createVector(0, 1.0), createVector(1, 1.0), createVector(2, 1.0)];

      afterEach(async () => {
        await vectorStore.deleteIndex(testIndexName);
      });

      it('should delete the vector by id', async () => {
        const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: testVectors });
        expect(ids).toHaveLength(3);
        const idToBeDeleted = ids[0];

        await vectorStore.deleteIndexById(testIndexName, idToBeDeleted);

        const results: QueryResult[] = await vectorStore.query({
          indexName: testIndexName,
          queryVector: createVector(0, 1.0),
          topK: 2,
        });

        expect(results).toHaveLength(2);
        expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
      });
    });
  });
  describe('Index Operations', () => {
    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };
    it('should create and list an index', async () => {
      // since, we do not have to create index explictly in case of upstash. Upserts are enough
      // for testing the listIndexes() function
      // await vectorStore.createIndex({ indexName: testIndexName, dimension: 3, metric: 'cosine' });
      const ids = await vectorStore.upsert({ indexName: testIndexName, vectors: [createVector(0, 1.0)] });
      expect(ids).toHaveLength(1);
      const indexes = await vectorStore.listIndexes();
      expect(indexes).toEqual([testIndexName]);
    });

    it('should describe an index correctly', async () => {
      const stats = await vectorStore.describeIndex('mastra_default');
      expect(stats).toEqual({
        dimension: 1536,
        metric: 'cosine',
        count: 0,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid dimension vectors', async () => {
      await expect(
        vectorStore.upsert({ indexName: testIndexName, vectors: [[1.0, 0.0]] }), // Wrong dimensions
      ).rejects.toThrow();
    });

    it('should handle querying with wrong dimensions', async () => {
      await expect(
        vectorStore.query({ indexName: testIndexName, queryVector: [1.0, 0.0] }), // Wrong dimensions
      ).rejects.toThrow();
    });
  });

  describe('Filter Tests', () => {
    const createVector = (dim: number) => new Array(VECTOR_DIMENSION).fill(0).map((_, i) => (i === dim ? 1 : 0));

    const testData = [
      {
        id: '1',
        vector: createVector(0),
        metadata: {
          name: 'Istanbul',
          population: 15460000,
          location: {
            continent: 'Asia',
            coordinates: {
              latitude: 41.0082,
              longitude: 28.9784,
            },
          },
          tags: ['historic', 'coastal', 'metropolitan'],
          industries: ['Tourism', 'Finance', 'Technology'],
          founded: 330,
          isCapital: false,
          lastCensus: null,
        },
      },
      {
        id: '2',
        vector: createVector(1),
        metadata: {
          name: 'Berlin',
          population: 3669495,
          location: {
            continent: 'Europe',
            coordinates: {
              latitude: 52.52,
              longitude: 13.405,
            },
          },
          tags: ['historic', 'cultural', 'metropolitan'],
          industries: ['Technology', 'Arts', 'Tourism'],
          founded: 1237,
          isCapital: true,
          lastCensus: 2021,
        },
      },
      {
        id: '3',
        vector: createVector(2),
        metadata: {
          name: 'San Francisco',
          population: 873965,
          location: {
            continent: 'North America',
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194,
            },
          },
          tags: ['coastal', 'tech', 'metropolitan'],
          industries: ['Technology', 'Finance', 'Tourism'],
          founded: 1776,
          isCapital: false,
          lastCensus: 2020,
        },
      },
      {
        id: '4',
        vector: createVector(3),
        metadata: {
          name: "City's Name",
          description: 'Contains "quotes"',
          population: 0,
          temperature: -10,
          microscopicDetail: 1e-10,
          isCapital: false,
          tags: ['nothing'],
        },
      },
    ];

    beforeAll(async () => {
      await vectorStore.createIndex({ indexName: filterIndexName, dimension: VECTOR_DIMENSION });
      await vectorStore.upsert({
        indexName: filterIndexName,
        vectors: testData.map(d => d.vector),
        metadata: testData.map(d => d.metadata),
        ids: testData.map(d => d.id),
      });
      // Wait for indexing
      await waitUntilVectorsIndexed(vectorStore, filterIndexName, testData.length);
    }, 50000);

    describe('Basic Operators', () => {
      it('should filter by exact match', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: 'Istanbul' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe('Istanbul');
      });

      it('should filter by not equal', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $ne: 'Berlin' } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.name).not.toBe('Berlin');
        });
      });

      it('should filter by greater than', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { population: { $gt: 1000000 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.population).toBeGreaterThan(1000000);
        });
      });

      it('should filter by less than or equal', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { founded: { $lte: 1500 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.founded).toBeLessThanOrEqual(1500);
        });
      });
    });

    describe('Array Operations', () => {
      it('should filter by array contains', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          topK: 10,
          filter: { tags: { $contains: 'historic' } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.tags).toContain('historic');
        });
      });

      it('should filter by array not contains', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { tags: { $not: { $contains: 'tech' } } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.tags?.find(tag => tag === 'tech')).toBeUndefined();
        });
      });

      it('should filter by in array', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'location.continent': { $in: ['Asia', 'Europe'] } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(['Asia', 'Europe']).toContain(result.metadata?.location?.continent);
        });
      });

      it('should filter by not in array', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $nin: ['Berlin', 'Istanbul'] } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(['Berlin', 'Istanbul']).not.toContain(result.metadata?.name);
        });
      });
    });

    describe('Array Indexing', () => {
      it('should filter by first array element', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'industries[0]': 'Tourism' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.industries?.[0]).toBe('Tourism');
      });

      it('should filter by last array element', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'industries[#-1]': 'Technology' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.industries?.slice(-1)[0]).toBe('Technology');
      });

      it('should combine first and last element filters', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'industries[0]': 'Tourism', 'tags[#-1]': 'metropolitan' },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.industries?.[0]).toBe('Tourism');
        expect(result?.tags?.slice(-1)[0]).toBe('metropolitan');
      });
    });

    describe('Nested Fields', () => {
      it('should filter by nested field', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'location.continent': 'Asia' },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.continent).toBe('Asia');
      });

      it('should filter by deeply nested field with comparison', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'location.coordinates.latitude': { $gt: 40 } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.location?.coordinates?.latitude).toBeGreaterThan(40);
        });
      });

      it('should combine nested and array filters', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'location.coordinates.latitude': { $gt: 40 }, 'industries[0]': 'Tourism' },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.location?.coordinates?.latitude).toBeGreaterThan(40);
        expect(result?.industries?.[0]).toBe('Tourism');
      });
    });

    describe('Logical Operators', () => {
      it('should combine conditions with AND', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $and: [{ population: { $gt: 1000000 } }, { isCapital: true }] },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.population).toBeGreaterThan(1000000);
        expect(result?.isCapital).toBe(true);
      });

      it('should combine conditions with OR', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $or: [{ 'location.continent': 'Asia' }, { 'location.continent': 'Europe' }] },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(['Asia', 'Europe']).toContain(result.metadata?.location?.continent);
        });
      });

      it('should handle NOT operator', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $not: { isCapital: true } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.isCapital).not.toBe(true);
        });
      });

      it('should handle NOT with comparison operators', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { population: { $not: { $lt: 1000000 } } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.population).toBeGreaterThanOrEqual(1000000);
        });
      });

      it('should handle NOT with contains operator', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { tags: { $not: { $contains: 'tech' } } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.tags?.find(tag => tag === 'tech')).toBeUndefined();
        });
      });

      it('should handle NOT with regex operator', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $not: { $regex: '*bul' } } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.name).not.toMatch(/bul$/);
        });
      });

      it('should handle NOR operator', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $nor: [{ 'location.continent': 'Asia' }, { 'location.continent': 'Europe' }] },
        });
        expect(results).toHaveLength(1);
        results.forEach(result => {
          expect(['Asia', 'Europe']).not.toContain(result.metadata?.location?.continent);
        });
      });

      it('should handle NOR with multiple conditions', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $nor: [{ population: { $gt: 10000000 } }, { isCapital: true }, { tags: { $contains: 'tech' } }] },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.population).toBeLessThanOrEqual(10000000);
        expect(result?.isCapital).not.toBe(true);
        expect(result?.tags).not.toContain('tech');
      });

      it('should handle ALL operator with simple values', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { industries: { $all: ['Tourism', 'Finance'] } },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.industries).toContain('Tourism');
          expect(result.metadata?.industries).toContain('Finance');
        });
      });

      it('should handle ALL operator with empty array', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { tags: { $all: [] } },
        });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle NOT with nested logical operators', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $not: { $and: [{ population: { $lt: 1000000 } }, { isCapital: true }] } },
        });
        expect(results).toHaveLength(4);
        results.forEach(result => {
          const metadata = result.metadata;
          expect(metadata?.population >= 1000000 || metadata?.isCapital !== true).toBe(true);
        });
      });

      it('should handle NOR with nested path conditions', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $nor: [
              { 'location.coordinates.latitude': { $lt: 40 } },
              { 'location.coordinates.longitude': { $gt: 100 } },
            ],
          },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          const coords = result.metadata?.location?.coordinates;
          expect(coords?.latitude >= 40 || coords?.longitude <= 100).toBe(true);
        });
      });

      it('should handle exists with nested paths', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $and: [
              { 'location.coordinates.latitude': { $exists: true } },
              { 'location.coordinates.longitude': { $exists: true } },
            ],
          },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.location?.coordinates?.latitude).toBeDefined();
          expect(result.metadata?.location?.coordinates?.longitude).toBeDefined();
        });
      });

      it('should handle complex NOT combinations', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $not: {
              $or: [
                { 'location.continent': 'Asia' },
                { population: { $lt: 1000000 } },
                { tags: { $contains: 'tech' } },
              ],
            },
          },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.location?.continent).not.toBe('Asia');
        expect(result?.population).toBeGreaterThanOrEqual(1000000);
        expect(result?.tags).not.toContain('tech');
      });

      it('should handle NOR with regex patterns', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $nor: [{ name: { $regex: '*bul' } }, { name: { $regex: '*lin' } }, { name: { $regex: '*cisco' } }],
          },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe("City's Name");
      });

      it('should handle NOR with mixed operator types', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $nor: [
              { population: { $gt: 5000000 } },
              { tags: { $contains: 'tech' } },
              { 'location.coordinates.latitude': { $lt: 38 } },
            ],
          },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.population).toBeLessThanOrEqual(5000000);
        expect(result?.tags).not.toContain('tech');
        expect(result?.location?.coordinates?.latitude).toBeGreaterThanOrEqual(38);
      });

      it('should handle NOR with exists operator', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $nor: [{ lastCensus: { $exists: true } }, { population: { $exists: false } }] },
        });
        expect(results).toHaveLength(1);
        const result = results[0]?.metadata;
        expect(result?.lastCensus).toBeUndefined();
        expect(result?.population).toBeDefined();
      });

      it('should handle ALL with mixed value types', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $and: [{ tags: { $contains: 'coastal' } }, { tags: { $contains: 'metropolitan' } }] },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          const tags = result.metadata?.tags || [];
          expect(tags).toContain('coastal');
          expect(tags).toContain('metropolitan');
        });
      });

      it('should handle ALL with nested array conditions', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $and: [{ industries: { $all: ['Tourism', 'Finance'] } }, { tags: { $all: ['metropolitan'] } }] },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.industries).toContain('Tourism');
          expect(result.metadata?.industries).toContain('Finance');
          expect(result.metadata?.tags).toContain('metropolitan');
        });
      });

      it('should handle ALL with complex conditions', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $or: [{ industries: { $all: ['Tourism', 'Finance'] } }, { tags: { $all: ['tech', 'metropolitan'] } }],
          },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          const hasAllIndustries =
            result.metadata?.industries?.includes('Tourism') && result.metadata?.industries?.includes('Finance');
          const hasAllTags = result.metadata?.tags?.includes('tech') && result.metadata?.tags?.includes('metropolitan');
          expect(hasAllIndustries || hasAllTags).toBe(true);
        });
      });

      it('should handle ALL with single item array', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { industries: { $all: ['Technology'] } },
        });
        expect(results).toHaveLength(3);
        results.forEach(result => {
          expect(result.metadata?.industries).toContain('Technology');
        });
      });

      it('should handle complex nested conditions', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: {
            $and: [
              { population: { $gt: 1000000 } },
              {
                $or: [{ 'location.continent': 'Asia' }, { industries: { $contains: 'Technology' } }],
              },
            ],
          },
        });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          const metadata = result.metadata;
          expect(metadata?.population).toBeGreaterThan(1000000);
          expect(metadata?.location?.continent === 'Asia' || metadata?.industries?.includes('Technology')).toBe(true);
        });
      });
    });

    describe('Edge Cases', () => {
      describe('Empty Conditions', () => {
        it('should handle empty AND array', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { $and: [] },
          });
          expect(results.length).toBeGreaterThan(0);
        });

        it('should handle empty OR array', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { $or: [] },
          });
          expect(results.length).toBe(0);
        });

        it('should handle empty IN array', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { tags: { $in: [] } },
          });
          expect(results.length).toBe(0);
        });
        it('should handle empty IN array', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { tags: [] },
          });
          expect(results.length).toBe(0);
        });
      });

      describe('Null/Undefined Values', () => {
        it('should handle null values', async () => {
          await expect(
            vectorStore.query({
              indexName: filterIndexName,
              queryVector: createVector(0),
              filter: { lastCensus: null },
            }),
          ).rejects.toThrow();
        });

        it('should handle null in arrays', async () => {
          await expect(
            vectorStore.query({
              indexName: filterIndexName,
              queryVector: createVector(0),
              filter: { tags: { $in: [null, 'historic'] } },
            }),
          ).rejects.toThrow();
        });
      });

      describe('Special Characters', () => {
        it('should handle strings with quotes', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { name: "City's Name" },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.name).toBe("City's Name");
        });

        it('should handle strings with double quotes', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { description: 'Contains "quotes"' },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.description).toBe('Contains "quotes"');
        });
      });

      describe('Number Formats', () => {
        it('should handle zero', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { population: 0 },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.population).toBe(0);
        });

        it('should handle negative numbers', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { temperature: -10 },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.temperature).toBe(-10);
        });

        it('should handle decimal numbers', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { 'location.coordinates.latitude': 41.0082 },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.location?.coordinates?.latitude).toBe(41.0082);
        });

        it('should handle scientific notation', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { microscopicDetail: 1e-10 },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.microscopicDetail).toBe(1e-10);
        });

        it('should handle escaped quotes in strings', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { description: { $regex: '*"quotes"*' } },
          });
          expect(results).toHaveLength(1);
          expect(results[0]?.metadata?.description).toBe('Contains "quotes"');
        });
        it('should handle undefined filter', async () => {
          const results1 = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: undefined,
          });
          const results2 = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
          });
          expect(results1).toEqual(results2);
          expect(results1.length).toBeGreaterThan(0);
        });

        it('should handle empty object filter', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: {},
          });
          const results2 = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
          });
          expect(results).toEqual(results2);
          expect(results.length).toBeGreaterThan(0);
        });

        it('should handle null filter', async () => {
          const results = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: null,
          });
          const results2 = await vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
          });
          expect(results).toEqual(results2);
          expect(results.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Pattern Matching', () => {
      it('should match start of string', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $regex: 'San*' } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe('San Francisco');
      });

      it('should match end of string', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $regex: '*in' } },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe('Berlin');
      });

      it('should handle negated pattern', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { name: { $not: { $regex: 'A*' } } },
        });
        expect(results).toHaveLength(4);
      });
    });

    describe('Field Existence', () => {
      it('should check field exists', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'location.coordinates': { $exists: true } },
        });
        expect(results).toHaveLength(3);
      });

      it('should check field does not exist', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { unknownField: { $exists: false } },
        });
        expect(results).toHaveLength(4);
      });
    });

    describe('Performance Tests', () => {
      it('should reject large arrays', async () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => `value${i}`);
        await expect(
          vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { tags: { $in: largeArray } },
          }),
        ).rejects.toThrow();
      });

      it('should handle deep nesting', async () => {
        const deepFilter = {
          $and: [
            { 'a.b.c.d.e': 1 },
            {
              $or: [
                { 'f.g.h.i.j': 2 },
                {
                  $and: [{ 'k.l.m.n.o': 3 }, { 'p.q.r.s.t': 4 }],
                },
              ],
            },
          ],
        };
        const start = Date.now();
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: deepFilter,
        });
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle complex combinations', async () => {
        const complexFilter = {
          $and: Array(10)
            .fill(null)
            .map((_, i) => ({
              $or: [
                { [`field${i}`]: { $gt: i } },
                { [`array${i}`]: { $contains: `value${i}` } },
                { [`nested${i}.field`]: { $in: [`value${i}`, `other${i}`] } },
              ],
            })),
        };
        const start = Date.now();
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: complexFilter,
        });
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should reject invalid operators', async () => {
        await expect(
          vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { field: { $invalidOp: 'value' } },
          }),
        ).rejects.toThrow();
      });

      it('should reject empty brackets', async () => {
        await expect(
          vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { 'industries[]': 'Tourism' },
          }),
        ).rejects.toThrow();
      });

      it('should reject unclosed brackets', async () => {
        await expect(
          vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { 'industries[': 'Tourism' },
          }),
        ).rejects.toThrow();
      });

      it('should handle invalid array syntax by returning empty results', async () => {
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { 'industries#-1]': 'Tourism' },
        });
        expect(results).toHaveLength(0);
      });

      it('should reject invalid field paths', async () => {
        await expect(
          vectorStore.query({
            indexName: filterIndexName,
            queryVector: createVector(0),
            filter: { '.invalidPath': 'value' },
          }),
        ).rejects.toThrow();
      });

      it('should handle malformed complex queries by returning all results', async () => {
        // Upstash treats malformed logical operators as non-filtering conditions
        // rather than throwing errors
        const results = await vectorStore.query({
          indexName: filterIndexName,
          queryVector: createVector(0),
          filter: { $and: { not: 'an array' } },
        });
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });
  describe('Deprecation Warnings', () => {
    const indexName = 'testdeprecationwarnings';

    const indexName2 = 'testdeprecationwarnings2';

    let warnSpy;

    afterAll(async () => {
      await vectorStore.deleteIndex(indexName);
      await vectorStore.deleteIndex(indexName2);
    });

    beforeEach(async () => {
      warnSpy = vi.spyOn(vectorStore['logger'], 'warn');
    });

    afterEach(async () => {
      warnSpy.mockRestore();
      await vectorStore.deleteIndex(indexName2);
    });

    const createVector = (primaryDimension: number, value: number = 1.0): number[] => {
      const vector = new Array(VECTOR_DIMENSION).fill(0);
      vector[primaryDimension] = value;
      // Normalize the vector for cosine similarity
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    };

    it('should show deprecation warning when using individual args for upsert', async () => {
      await vectorStore.upsert(indexName, [createVector(0, 2)], [{ test: 'data' }]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to upsert() is deprecated'),
      );
    });

    it('should show deprecation warning when using individual args for query', async () => {
      await vectorStore.query(indexName, createVector(0, 2), 5);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation Warning: Passing individual arguments to query() is deprecated'),
      );
    });

    it('should not show deprecation warning when using object param for query', async () => {
      await vectorStore.query({
        indexName,
        queryVector: createVector(0, 2),
        topK: 5,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for createIndex', async () => {
      await vectorStore.createIndex({
        indexName: indexName2,
        dimension: 3,
        metric: 'cosine',
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not show deprecation warning when using object param for upsert', async () => {
      await vectorStore.upsert({
        indexName,
        vectors: [createVector(0, 2)],
        metadata: [{ test: 'data' }],
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should maintain backward compatibility with individual args', async () => {
      // Query
      const queryResults = await vectorStore.query(indexName, createVector(0, 2), 5);
      expect(Array.isArray(queryResults)).toBe(true);

      // CreateIndex
      await expect(vectorStore.createIndex(indexName2, 3, 'cosine')).resolves.not.toThrow();

      // Upsert
      const upsertResults = await vectorStore.upsert({
        indexName,
        vectors: [createVector(0, 2)],
        metadata: [{ test: 'data' }],
      });
      expect(Array.isArray(upsertResults)).toBe(true);
      expect(upsertResults).toHaveLength(1);
    });
  });
});
