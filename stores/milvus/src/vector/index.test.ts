/**
 * MilvusStore Tests
 *
 * Note: Before running these tests, you need to start a Milvus server
 *
 * Please refer to the Milvus official documentation to install Milvus:
 * https://milvus.io/docs/install_standalone-docker-compose.md
 *
 */

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { MilvusStore } from './index';
import type { VectorFilter } from '@mastra/core/vector/filter';

describe('MilvusStore', () => {
  const TEST_COLLECTION = 'mastra_test_collection';
  const TEST_DIMENSION = 4;
  let store: MilvusStore;

  beforeEach(async () => {
    // Initialize store for testing
    store = new MilvusStore('localhost:19530');

    // Create test collection
    await store.createIndex({
      indexName: TEST_COLLECTION,
      dimension: TEST_DIMENSION,
    });
  });

  afterEach(async () => {
    // Clean up test collection
    await store.deleteIndex(TEST_COLLECTION);
  });

  test('should create and delete index', async () => {
    const testIndex = 'test_create_delete_index';

    // Create index
    await store.createIndex({
      indexName: testIndex,
      dimension: TEST_DIMENSION,
    });

    // Verify index exists
    const indexes = await store.listIndexes();
    expect(indexes).toContain(testIndex);

    // Delete index
    await store.deleteIndex(testIndex);

    // Verify index is deleted
    const indexesAfterDelete = await store.listIndexes();
    expect(indexesAfterDelete).not.toContain(testIndex);
  });

  test('should insert and query vectors', async () => {
    const vectors = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ];
    const metadata = [
      { name: 'doc1', category: 'test' },
      { name: 'doc2', category: 'test' },
      { name: 'doc3', category: 'test' },
    ];

    // Insert vectors
    const ids = await store.upsert({
      indexName: TEST_COLLECTION,
      vectors,
      metadata,
    });

    expect(ids).toHaveLength(3);

    // Query vectors
    const queryVector = [1, 2, 3, 4];
    const results = await store.query({
      indexName: TEST_COLLECTION,
      queryVector,
      topK: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(ids[0]);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].metadata).toEqual(metadata[0]);
  });

  test('should update vector and metadata', async () => {
    const vector = [1, 2, 3, 4];
    const metadata = { name: 'test_doc', category: 'test' };

    // Insert initial vector
    const [id] = await store.upsert({
      indexName: TEST_COLLECTION,
      vectors: [vector],
      metadata: [metadata],
    });

    // Update vector and metadata
    const updatedVector = [5, 6, 7, 8];
    const updatedMetadata = { name: 'updated_doc', category: 'test' };

    await store.updateVector(TEST_COLLECTION, id, {
      vector: updatedVector,
      metadata: updatedMetadata,
    });

    // Query to verify update
    const results = await store.query({
      indexName: TEST_COLLECTION,
      queryVector: updatedVector,
      topK: 1,
    });

    expect(results[0].id).toBe(id);
    expect(results[0].metadata).toEqual(updatedMetadata);
  });

  test('should delete vector', async () => {
    const vector = [1, 2, 3, 4];
    const metadata = { name: 'doc_to_delete', category: 'test' };

    // Insert vector
    const [id] = await store.upsert({
      indexName: TEST_COLLECTION,
      vectors: [vector],
      metadata: [metadata],
    });

    // Delete vector
    await store.deleteVector(TEST_COLLECTION, id);

    // Query to verify deletion
    const results = await store.query({
      indexName: TEST_COLLECTION,
      queryVector: vector,
      topK: 1,
    });

    expect(results).toHaveLength(0);
  });

  test('should filter documents', async () => {
    const vectors = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    const metadata = [
      { name: 'doc1', category: 'A', score: 90 },
      { name: 'doc2', category: 'B', score: 85 },
    ];

    // Insert vectors
    const ids = await store.upsert({
      indexName: TEST_COLLECTION,
      vectors,
      metadata,
    });

    // Query with filter
    const filter: VectorFilter = {
      category: 'A',
      score: { $gt: 85 },
    };

    const results = await store.query({
      indexName: TEST_COLLECTION,
      queryVector: [1, 2, 3, 4],
      topK: 2,
      filter,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(ids[0]);
    expect(results[0].metadata).toEqual(metadata[0]);
  });

  test('should handle complex filters', async () => {
    const vectors = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ];
    const metadata = [
      { name: 'doc1', category: 'A', score: 90, tags: ['important', 'urgent'] },
      { name: 'doc2', category: 'B', score: 85, tags: ['normal'] },
      { name: 'doc3', category: 'A', score: 95, tags: ['important'] },
    ];

    // Insert vectors
    await store.upsert({
      indexName: TEST_COLLECTION,
      vectors,
      metadata,
    });

    // Query with complex filter
    const filter: VectorFilter = {
      $and: [{ category: 'A' }, { score: { $gt: 85 } }, { name: { $in: ['doc1', 'doc3'] } }],
    };

    const results = await store.query({
      indexName: TEST_COLLECTION,
      queryVector: [1, 2, 3, 4],
      topK: 3,
      filter,
    });

    expect(results).toHaveLength(2);
    expect(results.map(r => r.metadata!.name)).toEqual(['doc1', 'doc3']);
  });

  test('should describe index', async () => {
    const stats = await store.describeIndex(TEST_COLLECTION);

    expect(stats).toHaveProperty('dimension', TEST_DIMENSION);
    expect(stats).toHaveProperty('count');
    expect(stats).toHaveProperty('metric');
  });
});
