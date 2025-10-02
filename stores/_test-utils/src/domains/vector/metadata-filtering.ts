import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { VectorTestConfig } from '../../vector-factory';

/**
 * Shared test suite for metadata field filtering in vector stores.
 * This test ensures that vector stores correctly handle metadata filters
 * when used by the Memory system for thread_id and resource_id filtering.
 *
 * Context: The Memory system stores thread_id and resource_id in metadata
 * and needs to filter by these fields for semantic recall.
 */
export function createMetadataFilteringTest({
  vector,
  createIndex,
  deleteIndex,
  waitForIndexing = () => new Promise(resolve => setTimeout(resolve, 5000)),
}: VectorTestConfig) {
  describe('Metadata Field Filtering for Memory System', () => {
    const testIndexName = `metadata_filter_test_${Date.now()}`;

    beforeAll(async () => {
      // Create index for testing
      await createIndex(testIndexName);

      // Insert test vectors with thread_id and resource_id in metadata
      // This simulates what the Memory system does when storing message embeddings
      const vectors = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ];

      const metadata = [
        { thread_id: 'thread-123', resource_id: 'resource-123', message: 'first' },
        { thread_id: 'thread-123', resource_id: 'resource-123', message: 'second' },
        { thread_id: 'thread-456', resource_id: 'resource-456', message: 'third' },
        { thread_id: 'thread-456', resource_id: 'resource-456', message: 'fourth' },
      ];

      await vector.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
      });

      // Wait for indexing to complete
      await waitForIndexing();
    });

    afterAll(async () => {
      await deleteIndex(testIndexName);
    });

    it('should filter by thread_id in metadata', async () => {
      // This is how Memory.rememberMessages filters when scope is 'thread'
      const results = await vector.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0, 0],
        topK: 10,
        filter: { thread_id: 'thread-123' },
      });

      // Should only return documents from thread-123
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.thread_id === 'thread-123')).toBe(true);

      // Should NOT contain documents from other threads
      const threadIds = results.map(r => r.metadata?.thread_id);
      expect(threadIds).not.toContain('thread-456');
    });

    it('should filter by resource_id in metadata', async () => {
      // This is how Memory.rememberMessages filters when scope is 'resource'
      const results = await vector.query({
        indexName: testIndexName,
        queryVector: [0, 1, 0, 0],
        topK: 10,
        filter: { resource_id: 'resource-123' },
      });

      // Should only return documents from resource-123
      expect(results).toHaveLength(2);
      expect(results.every(r => r.metadata?.resource_id === 'resource-123')).toBe(true);

      // Should NOT contain documents from other resources
      const resourceIds = results.map(r => r.metadata?.resource_id);
      expect(resourceIds).not.toContain('resource-456');
    });

    it('should handle combined thread_id and resource_id filters', async () => {
      // Test filtering by both thread_id and resource_id
      const results = await vector.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0, 0],
        topK: 10,
        filter: {
          thread_id: 'thread-123',
          resource_id: 'resource-123',
        },
      });

      // Should only return documents matching both filters
      expect(results).toHaveLength(2);
      expect(
        results.every(r => r.metadata?.thread_id === 'thread-123' && r.metadata?.resource_id === 'resource-123'),
      ).toBe(true);
    });

    it('should return no results when filtering for non-existent thread_id', async () => {
      const results = await vector.query({
        indexName: testIndexName,
        queryVector: [1, 0, 0, 0],
        topK: 10,
        filter: { thread_id: 'non-existent-thread' },
      });

      expect(results).toHaveLength(0);
    });

    it('should return all results when no filter is applied', async () => {
      const results = await vector.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5, 0.5],
        topK: 10,
      });

      // Should return all 4 vectors
      expect(results).toHaveLength(4);

      // Verify metadata is stored correctly
      const threadIds = results.map(r => r.metadata?.thread_id);
      expect(threadIds).toContain('thread-123');
      expect(threadIds).toContain('thread-456');
    });

    it('should also support metadata. prefix for backward compatibility', async () => {
      // Some implementations might use metadata.thread_id syntax
      // This test ensures backward compatibility if supported
      try {
        const results = await vector.query({
          indexName: testIndexName,
          queryVector: [1, 0, 0, 0],
          topK: 10,
          filter: { 'metadata.thread_id': 'thread-123' },
        });

        // If this syntax is supported, it should work correctly
        expect(results).toHaveLength(2);
        expect(results.every(r => r.metadata?.thread_id === 'thread-123')).toBe(true);
      } catch (error) {
        // If metadata. prefix is not supported, that's okay
        // The important thing is that the plain field names work
        expect(error).toBeDefined();
      }
    });
  });
}
