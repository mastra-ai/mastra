// To setup a Qdrant server, run:
// docker run -p 6333:6333 qdrant/qdrant
import { createVectorTestSuite } from '@internal/storage-test-utils';
import type { QueryResult } from '@mastra/core/vector';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';

import type { QdrantVectorFilter } from './filter';
import { QdrantVector } from './index';

const dimension = 3;

describe('QdrantVector', () => {
  let qdrant: QdrantVector;
  const testCollectionName = 'test-collection-' + Date.now();

  describe('Index Operations', () => {
    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should list collections including ours', async () => {
      const indexes = await qdrant.listIndexes();
      expect(indexes).toContain(testCollectionName);
    }, 50000);

    it('should describe index with correct properties', async () => {
      const stats = await qdrant.describeIndex({ indexName: testCollectionName });
      expect(stats.dimension).toBe(dimension);
      expect(stats.metric).toBe('cosine');
      expect(typeof stats.count).toBe('number');
    }, 50000);
  });

  describe('Vector Operations', () => {
    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ 
        indexName: testCollectionName, 
        dimension,
        namedVectors: {
          text: { size: dimension, distance: 'cosine' },
          image: { size: dimension, distance: 'cosine' }
        }
      });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    const testVectors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ];
    const testMetadata = [{ label: 'x-axis' }, { label: 'y-axis' }, { label: 'z-axis' }];
    let vectorIds: string[];

    it('should upsert vectors with metadata', async () => {
      vectorIds = await qdrant.upsert({ 
        indexName: testCollectionName, 
        vectors: testVectors, 
        metadata: testMetadata,
        vectorName: 'text'
      });
      expect(vectorIds).toHaveLength(3);
    }, 50000);

    it('should query using a named vector when `using` is provided', async () => {
      const queryVector = [1, 2, 3];
      const results = await qdrant.query({
        indexName: testCollectionName,
        queryVector,
        topK: 2,
        includeVector: true,
        using: 'text',
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
      // Verify that results contain vectors and metadata
      expect(results[0]?.vector).toBeDefined();
      expect(results[0]?.vector).toHaveLength(dimension);
      expect(results[0]?.metadata).toBeDefined();
      expect(results[0]?.score).toBeGreaterThan(0);
    });

    it('should query another named vector (image) when specified', async () => {
      // First upsert some vectors to the image vector space
      const imageVectors = [
        [0.5, 0.5, 0.0],
        [0.0, 0.5, 0.5],
      ];
      const imageMetadata = [{ type: 'image1' }, { type: 'image2' }];
      await qdrant.upsert({ 
        indexName: testCollectionName, 
        vectors: imageVectors, 
        metadata: imageMetadata,
        vectorName: 'image'
      });

      const queryVector = [0.5, 0.5, 0.0];
      const results = await qdrant.query({
        indexName: testCollectionName,
        queryVector,
        topK: 2,
        includeVector: true,
        using: 'image',
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.vector).toBeDefined();
      expect(results[0]?.metadata?.type).toMatch(/image/);
    });

    it('should query vectors and return nearest neighbors', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await qdrant.query({ 
        indexName: testCollectionName, 
        queryVector, 
        topK: 3,
        using: 'text'
      });

      expect(results).toHaveLength(3);
      expect(results?.[0]?.score).toBeGreaterThan(0);
      expect(results?.[0]?.metadata).toBeDefined();
    }, 50000);

    it('should query vectors and return vector in results', async () => {
      const queryVector = [1.0, 0.1, 0.1];
      const results = await qdrant.query({ 
        indexName: testCollectionName, 
        queryVector, 
        topK: 3, 
        includeVector: true,
        using: 'text'
      });

      expect(results).toHaveLength(3);
      expect(results?.[0]?.vector).toBeDefined();
      expect(results?.[0]?.vector).toHaveLength(dimension);
    });

    it('should query vectors with metadata filter', async () => {
      const queryVector = [0.0, 1.0, 0.0];
      const filter: QdrantVectorFilter = {
        label: 'y-axis',
      };

      const results = await qdrant.query({ 
        indexName: testCollectionName, 
        queryVector, 
        topK: 1, 
        filter,
        using: 'text'
      });

      expect(results).toHaveLength(1);
      expect(results?.[0]?.metadata?.label).toBe('y-axis');
    }, 50000);
  });

  describe('Named Vector Spaces - Comprehensive Coverage', () => {
    const namedVectorCollectionName = 'test-named-vectors-' + Date.now();

    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      // Create collection with multiple named vector spaces
      await qdrant.createIndex({ 
        indexName: namedVectorCollectionName, 
        dimension,
        namedVectors: {
          text: { size: dimension, distance: 'cosine' },
          image: { size: dimension, distance: 'euclidean' }
        }
      });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: namedVectorCollectionName });
    }, 50000);

    it('should upsert and query distinct records in multiple named vector spaces', async () => {
      // Upsert text vectors
      const textVectors = [
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.8, 0.2, 0.0],
      ];
      const textMetadata = [
        { type: 'text', content: 'doc1' },
        { type: 'text', content: 'doc2' },
        { type: 'text', content: 'doc3' },
      ];
      const textIds = await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: textVectors, 
        metadata: textMetadata,
        vectorName: 'text'
      });
      expect(textIds).toHaveLength(3);

      // Upsert image vectors (different vectors, same IDs to test isolation)
      const imageVectors = [
        [0.0, 0.0, 1.0],
        [0.0, 0.1, 0.9],
        [0.0, 0.2, 0.8],
      ];
      const imageMetadata = [
        { type: 'image', content: 'img1' },
        { type: 'image', content: 'img2' },
        { type: 'image', content: 'img3' },
      ];
      const imageIds = await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: imageVectors, 
        metadata: imageMetadata,
        vectorName: 'image',
        ids: textIds // Reuse same IDs to test that named vectors are independent
      });
      expect(imageIds).toHaveLength(3);
      expect(imageIds).toEqual(textIds);

      // Query text vector space
      const textQueryVector = [1.0, 0.0, 0.0];
      const textResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: textQueryVector,
        topK: 3,
        includeVector: true,
        using: 'text',
      });

      // Query image vector space
      const imageQueryVector = [0.0, 0.0, 1.0];
      const imageResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: imageQueryVector,
        topK: 3,
        includeVector: true,
        using: 'image',
      });

      // Assert results differ
      expect(textResults).toHaveLength(3);
      expect(imageResults).toHaveLength(3);
      
      // Text results should have text metadata
      expect(textResults[0]?.metadata?.type).toBe('text');
      expect(textResults[0]?.metadata?.content).toMatch(/doc/);
      
      // Image results should have image metadata
      expect(imageResults[0]?.metadata?.type).toBe('image');
      expect(imageResults[0]?.metadata?.content).toMatch(/img/);

      // Verify IDs are returned
      expect(textResults[0]?.id).toBeDefined();
      expect(imageResults[0]?.id).toBeDefined();
      expect(textIds).toContain(textResults[0]?.id);
      expect(imageIds).toContain(imageResults[0]?.id);

      // The top results should be different because we queried different vector spaces
      // Text query [1,0,0] should match text vectors better
      // Image query [0,0,1] should match image vectors better
      const textTopVector = textResults[0]?.vector;
      const imageTopVector = imageResults[0]?.vector;
      expect(textTopVector).toBeDefined();
      expect(imageTopVector).toBeDefined();
      expect(textTopVector).not.toEqual(imageTopVector);
    }, 50000);

    it('should return vectors from the correct named space when includeVector is true', async () => {
      // Clear and set up fresh data
      const textVec = [[0.7, 0.7, 0.0]];
      const imageVec = [[0.0, 0.7, 0.7]];
      
      const textId = await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: textVec, 
        metadata: [{ space: 'text-only' }],
        vectorName: 'text'
      });

      const imageId = await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: imageVec, 
        metadata: [{ space: 'image-only' }],
        vectorName: 'image',
        ids: textId // Same ID, different vector space
      });

      // Query text space with includeVector
      const textResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [0.7, 0.7, 0.0],
        topK: 1,
        includeVector: true,
        using: 'text',
        filter: { space: 'text-only' }
      });

      // Query image space with includeVector
      const imageResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [0.0, 0.7, 0.7],
        topK: 1,
        includeVector: true,
        using: 'image',
        filter: { space: 'image-only' }
      });

      // Assert vectors are returned and are from correct space
      expect(textResults).toHaveLength(1);
      expect(textResults[0]?.vector).toBeDefined();
      expect(textResults[0]?.vector).toHaveLength(dimension);
      
      expect(imageResults).toHaveLength(1);
      expect(imageResults[0]?.vector).toBeDefined();
      expect(imageResults[0]?.vector).toHaveLength(dimension);

      // Verify the vectors are different (from different spaces)
      expect(textResults[0]?.vector).not.toEqual(imageResults[0]?.vector);

      // Verify vector values match what we inserted (approximately, due to normalization)
      const textReturnedVec = textResults[0]?.vector || [];
      const imageReturnedVec = imageResults[0]?.vector || [];
      
      // Text vector should have high values in first two dimensions
      expect(textReturnedVec[0]).toBeGreaterThan(0.4);
      expect(textReturnedVec[1]).toBeGreaterThan(0.4);
      
      // Image vector should have high values in last two dimensions
      expect(imageReturnedVec[1]).toBeGreaterThan(0.4);
      expect(imageReturnedVec[2]).toBeGreaterThan(0.4);
    }, 50000);

    it('should handle querying a non-existent named vector appropriately', async () => {
      // Insert some data
      await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: [[1.0, 0.0, 0.0]], 
        metadata: [{ test: 'data' }],
        vectorName: 'text'
      });

      // Try to query with a non-existent named vector
      const queryPromise = qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 1,
        using: 'nonexistent',
      });

      // Assert that it throws an error (Qdrant should reject invalid vector names)
      await expect(queryPromise).rejects.toThrow();
    }, 50000);

    it('should combine named vector query with metadata filters correctly', async () => {
      // Set up data with overlapping metadata but different vector spaces
      const textVectors = [
        [1.0, 0.0, 0.0],
        [0.9, 0.1, 0.0],
        [0.8, 0.2, 0.0],
      ];
      const textMetadata = [
        { category: 'A', priority: 1, source: 'text' },
        { category: 'B', priority: 2, source: 'text' },
        { category: 'A', priority: 3, source: 'text' },
      ];
      
      const imageVectors = [
        [0.0, 0.0, 1.0],
        [0.0, 0.1, 0.9],
        [0.0, 0.2, 0.8],
      ];
      const imageMetadata = [
        { category: 'A', priority: 1, source: 'image' },
        { category: 'B', priority: 2, source: 'image' },
        { category: 'A', priority: 3, source: 'image' },
      ];

      await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: textVectors, 
        metadata: textMetadata,
        vectorName: 'text'
      });

      await qdrant.upsert({ 
        indexName: namedVectorCollectionName, 
        vectors: imageVectors, 
        metadata: imageMetadata,
        vectorName: 'image'
      });

      // Query text space with filter for category A
      const textFilteredResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 10,
        using: 'text',
        filter: { category: 'A' },
        includeVector: true,
      });

      // Query image space with filter for category A
      const imageFilteredResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [0.0, 0.0, 1.0],
        topK: 10,
        using: 'image',
        filter: { category: 'A' },
        includeVector: true,
      });

      // Assert correct number of results (2 items with category A in each space)
      expect(textFilteredResults.length).toBe(2);
      expect(imageFilteredResults.length).toBe(2);

      // Assert all results have category A
      textFilteredResults.forEach(result => {
        expect(result.metadata?.category).toBe('A');
        expect(result.metadata?.source).toBe('text');
      });

      imageFilteredResults.forEach(result => {
        expect(result.metadata?.category).toBe('A');
        expect(result.metadata?.source).toBe('image');
      });

      // Assert vectors are from correct spaces
      expect(textFilteredResults[0]?.vector).toBeDefined();
      expect(imageFilteredResults[0]?.vector).toBeDefined();
      expect(textFilteredResults[0]?.vector).not.toEqual(imageFilteredResults[0]?.vector);

      // Query with more complex filter (category A AND priority > 1)
      const complexFilterResults = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 10,
        using: 'text',
        filter: { 
          category: 'A',
          priority: { $gt: 1 }
        },
        includeVector: true,
      });

      // Should only return 1 result (category A with priority 3)
      expect(complexFilterResults.length).toBe(1);
      expect(complexFilterResults[0]?.metadata?.category).toBe('A');
      expect(complexFilterResults[0]?.metadata?.priority).toBe(3);
      expect(complexFilterResults[0]?.metadata?.source).toBe('text');
      expect(complexFilterResults[0]?.id).toBeDefined();
      expect(complexFilterResults[0]?.vector).toHaveLength(dimension);
    }, 50000);

    it('should handle empty results when filter excludes all vectors in named space', async () => {
      // Query with filter that matches nothing
      const results = await qdrant.query({
        indexName: namedVectorCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 10,
        using: 'text',
        filter: { category: 'NONEXISTENT' },
      });

      expect(results).toHaveLength(0);
    }, 50000);
  });

  describe('Default Vector Operations (backward compatibility)', () => {
    const defaultCollectionName = 'test-default-collection-' + Date.now();

    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      // Create collection with default vector (no named vectors)
      await qdrant.createIndex({ indexName: defaultCollectionName, dimension });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: defaultCollectionName });
    }, 50000);

    it('should upsert and query with default vector space', async () => {
      const testVectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
      ];
      const testMetadata = [{ label: 'default-x' }, { label: 'default-y' }];
      
      // Upsert without vectorName parameter
      const vectorIds = await qdrant.upsert({ 
        indexName: defaultCollectionName, 
        vectors: testVectors, 
        metadata: testMetadata
      });
      expect(vectorIds).toHaveLength(2);

      // Query without using parameter (should use default vector)
      const queryVector = [1.0, 0.1, 0.0];
      const results = await qdrant.query({
        indexName: defaultCollectionName,
        queryVector,
        topK: 2,
        includeVector: true,
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.vector).toBeDefined();
      expect(results[0]?.vector).toHaveLength(dimension);
      expect(results[0]?.metadata).toBeDefined();
    }, 50000);
  });

  describe('Vector update operations', () => {
    const testVectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    beforeEach(async () => {
      await qdrant.createIndex({ indexName: testCollectionName, dimension: 3 });
    });

    afterEach(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    });

    it('should update the vector by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [1, 2, 3];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        vector: newVector,
        metadata: newMetaData,
      };

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      console.log(results);
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(newVector);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update the metadata by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newMetaData = {
        test: 'updates',
      };

      const update = {
        metadata: newMetaData,
      };

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: testVectors[0],
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(testVectors[0]);
      expect(results[0]?.metadata).toEqual(newMetaData);
    });

    it('should only update vector embeddings by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);

      const idToBeUpdated = ids[0];
      const newVector = [4, 4, 4];

      const update = {
        vector: newVector,
      };

      await qdrant.updateVector({ indexName: testCollectionName, id: idToBeUpdated, update });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: newVector,
        topK: 2,
        includeVector: true,
      });
      expect(results[0]?.id).toBe(idToBeUpdated);
      // not matching the vector in results list because, the stored vector is stored in a normalized form inside qdrant
      // expect(results[0]?.vector).toEqual(newVector);
    });

    it('should throw exception when no updates are given', async () => {
      await expect(qdrant.updateVector({ indexName: testCollectionName, id: 'id', update: {} })).rejects.toThrow(
        'No updates provided',
      );
    });

    it('should throw error for non-existent index', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(
        qdrant.updateVector({ indexName: nonExistentIndex, id: 'test-id', update: { vector: [1, 2, 3] } }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid vector dimension', async () => {
      const [id] = await qdrant.upsert({
        indexName: testCollectionName,
        vectors: [[1, 2, 3]],
        metadata: [{ test: 'initial' }],
      });

      await expect(
        qdrant.updateVector({ indexName: testCollectionName, id, update: { vector: [1, 2] } }), // Wrong dimension
      ).rejects.toThrow();
    });
  });

  describe('Vector delete operations', () => {
    const testVectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    beforeEach(async () => {
      await qdrant.createIndex({ indexName: testCollectionName, dimension: 3 });
    });

    afterEach(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    });

    it('should delete the vector by id', async () => {
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors: testVectors });
      expect(ids).toHaveLength(3);
      const idToBeDeleted = ids[0];

      await qdrant.deleteVector({ indexName: testCollectionName, id: idToBeDeleted });

      const results: QueryResult[] = await qdrant.query({
        indexName: testCollectionName,
        queryVector: [1.0, 0.0, 0.0],
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results.map(res => res.id)).not.toContain(idToBeDeleted);
    });
  });

  describe('Filter Queries', () => {
    const filterTestVectors = Array(10)
      .fill(null)
      .map(() =>
        Array(dimension)
          .fill(null)
          .map(() => Math.random()),
      );

    const filterTestMetadata = [
      {
        name: 'item1',
        tags: ['electronics', 'premium'],
        price: 1000,
        inStock: true,
        details: {
          color: 'red',
          sizes: ['S', 'M', 'L'],
          weight: 2.5,
        },
        location: {
          lat: 52.5,
          lon: 13.4,
        },
        stock: {
          quantity: 50,
          locations: [
            { warehouse: 'A', count: 30 },
            { warehouse: 'B', count: 20 },
          ],
        },
        ratings: [4.5, 4.8, 4.2],
      },
      {
        name: 'item2',
        tags: ['electronics', 'basic'],
        price: 500,
        inStock: false,
        details: {
          color: 'blue',
          sizes: ['M', 'L'],
          weight: 1.8,
        },
        location: {
          lat: 48.2,
          lon: 16.3,
        },
        stock: {
          quantity: 0,
          locations: [],
        },
        ratings: [4.0, 3.8],
      },
      {
        name: 'item3',
        tags: ['books', 'bestseller'],
        price: 25,
        inStock: true,
        details: {
          color: 'green',
          sizes: ['standard'],
          weight: 0.5,
        },
        location: {
          lat: 40.7,
          lon: -74.0,
        },
        stock: {
          quantity: 100,
          locations: [
            { warehouse: 'A', count: 50 },
            { warehouse: 'C', count: 50 },
          ],
        },
        ratings: [4.9],
      },
      {
        name: 'item4',
        tags: [],
        price: null,
        inStock: null,
        details: {
          color: null,
          sizes: [],
          weight: null,
        },
        location: null,
        stock: {
          quantity: null,
          locations: null,
        },
        ratings: null,
      },
    ];

    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
      await qdrant.upsert({ indexName: testCollectionName, vectors: filterTestVectors, metadata: filterTestMetadata });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    describe('Basic Operators', () => {
      it('should filter by exact value match', async () => {
        const filter: QdrantVectorFilter = { name: 'item1' };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.name).toBe('item1');
      });

      it('should filter using comparison operators', async () => {
        const filter: QdrantVectorFilter = { price: { $gt: 100, $lt: 600 } };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(500);
      });

      it('should filter using array operators', async () => {
        const filter: QdrantVectorFilter = { tags: { $in: ['premium', 'bestseller'] } };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        const tags = results.flatMap(r => r.metadata?.tags || []);
        expect(tags).toContain('bestseller');
        expect(tags).toContain('premium');
      });

      it('should handle null values', async () => {
        const filter: QdrantVectorFilter = { price: null };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBeNull();
      });

      it('should handle empty arrays', async () => {
        const filter: QdrantVectorFilter = {
          tags: [],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const resultsWithMetadata = results.filter(r => Object.keys(r?.metadata || {}).length > 0);
        expect(resultsWithMetadata).toHaveLength(1);
        expect(resultsWithMetadata[0]?.metadata?.tags).toHaveLength(0);
      });
    });

    describe('Logical Operators', () => {
      it('should combine conditions with $and', async () => {
        const filter: QdrantVectorFilter = {
          $and: [{ tags: { $in: ['electronics'] } }, { price: { $gt: 700 } }],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBeGreaterThan(700);
        expect(results[0]?.metadata?.tags).toContain('electronics');
      });

      it('should combine conditions with $or', async () => {
        const filter: QdrantVectorFilter = {
          $or: [{ price: { $gt: 900 } }, { tags: { $in: ['bestseller'] } }],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.price > 900 || result.metadata?.tags?.includes('bestseller')).toBe(true);
        });
      });

      it('should handle $not operator', async () => {
        const filter: QdrantVectorFilter = {
          $not: { tags: { $in: ['electronics'] } },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const resultsWithMetadata = results.filter(r => Object.keys(r?.metadata || {}).length > 0);
        expect(resultsWithMetadata).toHaveLength(2);
        resultsWithMetadata.forEach(result => {
          expect(result.metadata?.tags).not.toContain('electronics');
        });
      });

      it('should handle nested logical operators', async () => {
        const filter: QdrantVectorFilter = {
          $and: [
            { 'details.weight': { $lt: 2.0 } },
            {
              $or: [{ tags: { $in: ['basic'] } }, { tags: { $in: ['bestseller'] } }],
            },
          ],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.details?.weight).toBeLessThan(2.0);
          expect(result.metadata?.tags?.includes('basic') || result.metadata?.tags?.includes('bestseller')).toBe(true);
        });
      });

      it('should handle empty logical operators', async () => {
        const filter: QdrantVectorFilter = { $and: [] };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('Custom Operators', () => {
      it('should filter using $count operator', async () => {
        const filter: QdrantVectorFilter = { 'stock.locations': { $count: { $gt: 1 } } };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.stock?.locations?.length).toBeGreaterThan(1);
        });
      });

      it('should filter using $geo radius operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'radius',
              center: { lat: 52.5, lon: 13.4 },
              radius: 10000,
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $geo box operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'box',
              top_left: { lat: 53.0, lon: 13.0 },
              bottom_right: { lat: 52.0, lon: 14.0 },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $geo polygon operator', async () => {
        const filter: QdrantVectorFilter = {
          location: {
            $geo: {
              type: 'polygon',
              exterior: {
                points: [
                  { lat: 53.0, lon: 13.0 },
                  { lat: 53.0, lon: 14.0 },
                  { lat: 52.0, lon: 14.0 },
                  { lat: 52.0, lon: 13.0 },
                  { lat: 53.0, lon: 13.0 }, // Close the polygon by repeating first point
                ],
              },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.location?.lat).toBe(52.5);
        expect(results[0]?.metadata?.location?.lon).toBe(13.4);
      });

      it('should filter using $hasId operator', async () => {
        // First get some IDs from a regular query
        const allResults = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], topK: 2 });
        const targetIds = allResults.map(r => r.id);

        const filter: QdrantVectorFilter = { $hasId: targetIds };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(targetIds).toContain(result.id);
        });
      });

      it('should filter using $hasVector operator', async () => {
        const filter: QdrantVectorFilter = { $hasVector: '' };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should filter using $datetime operator', async () => {
        // First upsert a record with a datetime
        const now = new Date();
        const vector = Array(dimension)
          .fill(null)
          .map(() => Math.random());
        const metadata = {
          created_at: now.toISOString(),
        };
        await qdrant.upsert({ indexName: testCollectionName, vectors: [vector], metadata: [metadata] });

        const filter: QdrantVectorFilter = {
          created_at: {
            $datetime: {
              range: {
                gt: new Date(now.getTime() - 1000), // 1 second before
                lt: new Date(now.getTime() + 1000), // 1 second after
              },
            },
          },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          expect(new Date(result.metadata?.created_at).getTime()).toBeGreaterThan(now.getTime() - 1000);
          expect(new Date(result.metadata?.created_at).getTime()).toBeLessThan(now.getTime() + 1000);
        });
      });
    });

    describe('Special Cases', () => {
      it('handles regex patterns in queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { name: { $regex: 'item' } },
        });
        expect(results.length).toBe(4);
      });

      it('handles array operators in queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { tags: { $in: ['electronics', 'books'] } },
        });
        expect(results.length).toBe(3);
      });

      it('handles nested array queries', async () => {
        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { 'stock.locations[]': { $nested: { warehouse: 'A', count: { $gt: 20 } } } },
        });
        expect(results.length).toBe(2);
      });

      it('handles collection-wide operators', async () => {
        // First get some actual IDs from our collection
        const searchResults = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], topK: 2 });
        const ids = searchResults.map(r => r.id);

        const results = await qdrant.query({
          indexName: testCollectionName,
          queryVector: [1, 0, 0],
          filter: { $hasId: ids, $hasVector: '' },
        });
        expect(results.length).toBe(2);
      });
      it('should handle nested paths', async () => {
        const filter: QdrantVectorFilter = {
          'details.color': 'red',
          'stock.quantity': { $gt: 0 },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.details?.color).toBe('red');
        expect(results[0]?.metadata?.stock?.quantity).toBeGreaterThan(0);
      });

      it('should handle multiple conditions on same field', async () => {
        const filter: QdrantVectorFilter = {
          price: { $gt: 20, $lt: 30 },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.price).toBe(25);
      });

      it('should handle complex combinations', async () => {
        const filter: QdrantVectorFilter = {
          $and: [
            { 'details.weight': { $lt: 3.0 } },
            {
              $or: [{ price: { $gt: 500 } }, { 'stock.quantity': { $gt: 50 } }],
            },
            { $not: { tags: { $in: ['basic'] } } },
          ],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.details?.weight).toBeLessThan(3.0);
          expect(result.metadata?.price > 500 || result.metadata?.stock?.quantity > 50).toBe(true);
          expect(result.metadata?.tags).not.toContain('basic');
        });
      });

      it('should handle array paths with nested objects', async () => {
        const filter: QdrantVectorFilter = {
          'stock.locations[].warehouse': { $in: ['A'] },
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result.metadata?.stock?.locations?.some((loc: any) => loc.warehouse === 'A')).toBe(true);
        });
      });

      it('should handle multiple nested paths with array notation', async () => {
        const filter: QdrantVectorFilter = {
          $and: [{ 'stock.locations[].warehouse': { $in: ['A'] } }, { 'stock.locations[].count': { $gt: 20 } }],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results).toHaveLength(2);
        results.forEach(result => {
          const locations = result.metadata?.stock?.locations || [];
          expect(locations.some((loc: any) => loc.warehouse === 'A' && loc.count > 20)).toBe(true);
        });
      });

      it('should handle complex date range queries', async () => {
        const now = new Date();
        const vector = Array(dimension)
          .fill(null)
          .map(() => Math.random());
        const metadata = {
          timestamps: {
            created: now.toISOString(),
            updated: new Date(now.getTime() + 1000).toISOString(),
          },
        };
        await qdrant.upsert({ indexName: testCollectionName, vectors: [vector], metadata: [metadata] });

        const filter: QdrantVectorFilter = {
          $and: [
            {
              'timestamps.created': {
                $gt: new Date(now.getTime() - 1000).toISOString(),
              },
            },
            {
              'timestamps.updated': {
                $lt: new Date(now.getTime() + 2000).toISOString(),
              },
            },
          ],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle complex combinations with custom operators', async () => {
        const filter: QdrantVectorFilter = {
          $and: [
            { 'stock.locations': { $count: { $gt: 0 } } },
            {
              $or: [
                {
                  location: {
                    $geo: {
                      type: 'radius',
                      center: { lat: 52.5, lon: 13.4 },
                      radius: 10000,
                    },
                  },
                },
                { tags: { $in: ['bestseller'] } },
              ],
            },
          ],
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
          const metadata = result.metadata || {};
          expect(metadata.stock?.locations?.length).toBeGreaterThan(0);
          const location = metadata.location;
          const isNearLocation = location?.lat === 52.5 && location?.lon === 13.4;
          const isBestseller = metadata.tags?.includes('bestseller');
          expect(isNearLocation || isBestseller).toBe(true);
        });
      });
    });

    describe('Performance Cases', () => {
      it('should handle deep nesting efficiently', async () => {
        const start = Date.now();
        const filter: QdrantVectorFilter = {
          $and: Array(5)
            .fill(null)
            .map(() => ({
              $or: [{ 'details.weight': { $lt: 2.0 } }, { 'stock.quantity': { $gt: 0 } }],
            })),
        };
        const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter });
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
        expect(results.length).toBeGreaterThan(0);
      });

      it('should handle multiple concurrent filtered queries', async () => {
        const filters: QdrantVectorFilter[] = [
          { price: { $gt: 500 } },
          { tags: { $in: ['electronics'] } },
          { 'stock.quantity': { $gt: 0 } },
        ];
        const start = Date.now();
        const results = await Promise.all(
          filters.map(filter => qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter })),
        );
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        results.forEach(result => {
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });
  describe('Error Handling', () => {
    const testIndexName = 'test_index_error';
    beforeAll(async () => {
      await qdrant.createIndex({ indexName: testIndexName, dimension: 3 });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testIndexName });
    });

    it('should handle non-existent index query gracefully', async () => {
      const nonExistentIndex = 'non-existent-index';
      await expect(qdrant.query({ indexName: nonExistentIndex, queryVector: [1, 0, 0] })).rejects.toThrow();
    }, 50000);

    it('should handle incorrect dimension vectors', async () => {
      const wrongDimVector = [[1, 0]]; // 2D vector for 3D index
      await expect(qdrant.upsert({ indexName: testCollectionName, vectors: wrongDimVector })).rejects.toThrow();
    }, 50000);

    it('should handle mismatched metadata and vectors length', async () => {
      const vectors = [[1, 2, 3]];
      const metadata = [{}, {}];
      await expect(qdrant.upsert({ indexName: testCollectionName, vectors, metadata })).rejects.toThrow();
    });

    it('should handle duplicate index creation gracefully', async () => {
      const duplicateIndexName = `duplicate_test`;
      const dimension = 768;
      const infoSpy = vi.spyOn(qdrant['logger'], 'info');
      const warnSpy = vi.spyOn(qdrant['logger'], 'warn');
      try {
        // Create index first time
        await qdrant.createIndex({
          indexName: duplicateIndexName,
          dimension,
          metric: 'cosine',
        });

        // Try to create with same dimensions - should not throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'cosine',
          }),
        ).resolves.not.toThrow();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('already exists with'));

        // Try to create with same dimensions and different metric - should not throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension,
            metric: 'euclidean',
          }),
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Attempted to create index with metric'));

        // Try to create with different dimensions - should throw
        await expect(
          qdrant.createIndex({
            indexName: duplicateIndexName,
            dimension: dimension + 1,
            metric: 'cosine',
          }),
        ).rejects.toThrow(
          `Index "${duplicateIndexName}" already exists with ${dimension} dimensions, but ${dimension + 1} dimensions were requested`,
        );
      } finally {
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        // Cleanup
        await qdrant.deleteIndex({ indexName: duplicateIndexName });
      }
    });
  });

  describe('Empty/Undefined Filters', () => {
    const filterTestVectors = Array(10)
      .fill(null)
      .map(() =>
        Array(dimension)
          .fill(null)
          .map(() => Math.random()),
      );

    const filterTestMetadata = [
      {
        name: 'item1',
        tags: ['electronics', 'premium'],
        price: 1000,
        inStock: true,
        details: {
          color: 'red',
          sizes: ['S', 'M', 'L'],
          weight: 2.5,
        },
        location: {
          lat: 52.5,
          lon: 13.4,
        },
        stock: {
          quantity: 50,
          locations: [
            { warehouse: 'A', count: 30 },
            { warehouse: 'B', count: 20 },
          ],
        },
        ratings: [4.5, 4.8, 4.2],
      },
    ];

    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
      await qdrant.upsert({ indexName: testCollectionName, vectors: filterTestVectors, metadata: filterTestMetadata });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);
    it('should handle undefined filter', async () => {
      const results1 = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter: undefined });
      const results2 = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results1).toEqual(results2);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('should handle empty object filter', async () => {
      const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter: {} });
      const results2 = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle null filter', async () => {
      const results = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0], filter: null });
      const results2 = await qdrant.query({ indexName: testCollectionName, queryVector: [1, 0, 0] });
      expect(results).toEqual(results2);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    beforeAll(async () => {
      qdrant = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-test' });
      await qdrant.createIndex({ indexName: testCollectionName, dimension });
    });

    afterAll(async () => {
      await qdrant.deleteIndex({ indexName: testCollectionName });
    }, 50000);

    it('should handle batch upsert of 1000 vectors', async () => {
      const batchSize = 1000;
      const vectors = Array(batchSize)
        .fill(null)
        .map(() =>
          Array(dimension)
            .fill(null)
            .map(() => Math.random()),
        );
      const metadata = vectors.map((_, i) => ({ id: i }));

      const start = Date.now();
      const ids = await qdrant.upsert({ indexName: testCollectionName, vectors, metadata });
      const duration = Date.now() - start;

      expect(ids).toHaveLength(batchSize);
      console.log(`Batch upsert of ${batchSize} vectors took ${duration}ms`);
    }, 300000);

    it('should perform multiple concurrent queries', async () => {
      const queryVector = [1, 0, 0];
      const numQueries = 10;

      const start = Date.now();
      const promises = Array(numQueries)
        .fill(null)
        .map(() => qdrant.query({ indexName: testCollectionName, queryVector }));

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(numQueries);
      console.log(`${numQueries} concurrent queries took ${duration}ms`);
    }, 50000);
  });
});

// Metadata filtering tests for Memory system
describe('Qdrant Metadata Filtering', () => {
  const qdrantVector = new QdrantVector({ url: 'http://localhost:6333/', id: 'qdrant-metadata-test' });

  createVectorTestSuite({
    vector: qdrantVector,
    createIndex: async (indexName: string) => {
      await qdrantVector.createIndex({ indexName, dimension: 4 });
    },
    deleteIndex: async (indexName: string) => {
      await qdrantVector.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {
      // Qdrant indexes immediately
      await new Promise(resolve => setTimeout(resolve, 100));
    },
  });
});
