import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { VectorTestConfig } from '../../vector-factory';
import { createVector } from './test-helpers';

/**
 * Shared test suite for advanced vector operations (deleteVectors and updateVector with filters).
 * These tests validate the new unified deletion and update APIs that support both
 * filter-based and ID-based operations.
 
 */
export function createAdvancedOperationsTest(config: VectorTestConfig) {
  const {
    createIndex,
    deleteIndex,
    waitForIndexing = (indexName: string) => new Promise(resolve => setTimeout(resolve, 100)),
  } = config;

  describe('Advanced Vector Operations', () => {
    let testIndexName: string;

    beforeEach(async () => {
      // Create unique index name for each test to avoid index state pollution
      testIndexName = `advancedopstest${Date.now()}${Math.random().toString(36).substring(7)}`;

      // Create fresh index for each test
      try {
        await deleteIndex(testIndexName);
      } catch {
        // Ignore if doesn't exist
      }
      await createIndex(testIndexName);
      await waitForIndexing(testIndexName);
    });

    afterEach(async () => {
      try {
        await deleteIndex(testIndexName);
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('deleteVectors() with filter', () => {
      it('should delete vectors matching a simple filter', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7)],
          metadata: [{ source_id: 'doc1.pdf' }, { source_id: 'doc2.pdf' }, { source_id: 'doc1.pdf' }],
        });

        await waitForIndexing(testIndexName);

        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(3);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: { source_id: 'doc1.pdf' },
        });

        await waitForIndexing(testIndexName);

        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(1);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        expect(results[0]?.metadata?.source_id).toBe('doc2.pdf');
      });

      it('should delete vectors matching complex filters with $and', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [
            { tenant: 'acme', env: 'prod' },
            { tenant: 'acme', env: 'dev' },
            { tenant: 'globex', env: 'prod' },
            { tenant: 'acme', env: 'staging' },
          ],
        });

        await waitForIndexing(testIndexName);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: {
            $and: [{ tenant: 'acme' }, { env: 'prod' }],
          },
        });

        await waitForIndexing(testIndexName);

        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(3);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        const envs = results.map(r => r.metadata?.env).sort();
        expect(envs).toEqual(['dev', 'prod', 'staging']);

        // Verify the prod that remains is from globex, not acme
        const prodVector = results.find(r => r.metadata?.env === 'prod');
        expect(prodVector?.metadata?.tenant).toBe('globex');
      });

      it('should delete vectors matching filters with $or', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [{ status: 'active' }, { status: 'archived' }, { status: 'deleted' }, { status: 'pending' }],
        });

        await waitForIndexing(testIndexName);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: {
            $or: [{ status: 'archived' }, { status: 'deleted' }],
          },
        });

        await waitForIndexing(testIndexName);

        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        const statuses = results.map(r => r.metadata?.status).sort();
        expect(statuses).toEqual(['active', 'pending']);
      });

      it('should delete vectors matching filters with $in', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2), createVector(3)],
          metadata: [{ category: 'A' }, { category: 'B' }, { category: 'C' }, { category: 'D' }, { category: 'E' }],
        });

        await waitForIndexing(testIndexName);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: {
            category: { $in: ['B', 'D'] },
          },
        });

        await waitForIndexing(testIndexName);

        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(3);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        const categories = results.map(r => r.metadata?.category).sort();
        expect(categories).toEqual(['A', 'C', 'E']);
      });

      it('should handle deletion when no vectors match the filter', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1)],
          metadata: [{ name: 'test' }],
        });

        await waitForIndexing(testIndexName);

        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(1);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: { name: 'nonexistent' },
        });

        await waitForIndexing(testIndexName);

        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(1);
      });

      it('should throw error for empty filter', async () => {
        await expect(
          config.vector.deleteVectors({
            indexName: testIndexName,
            filter: {},
          }),
        ).rejects.toThrow(/empty filter/i);
      });
    }, 50000);

    describe('deleteVectors() with IDs', () => {
      it('should delete vectors by array of IDs', async () => {
        const ids = await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [{ name: 'vec1' }, { name: 'vec2' }, { name: 'vec3' }, { name: 'vec4' }],
        });

        await waitForIndexing(testIndexName);

        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(4);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          ids: [ids[0]!, ids[2]!],
        });

        await waitForIndexing(testIndexName);

        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(2);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        const names = results.map(r => r.metadata?.name).sort();
        expect(names).toEqual(['vec2', 'vec4']);
      }, 15000);

      it('should handle empty ids array', async () => {
        await expect(
          config.vector.deleteVectors({
            indexName: testIndexName,
            ids: [],
          }),
        ).rejects.toThrow(/empty ids array/i);
      }, 15000);

      it('should handle deletion of non-existent IDs gracefully', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1)],
          metadata: [{ name: 'vec1' }],
        });

        await waitForIndexing(testIndexName);

        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(1);

        await config.vector.deleteVectors({
          indexName: testIndexName,
          ids: ['nonexistent-1', 'nonexistent-2'],
        });

        await waitForIndexing(testIndexName);

        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(1);
      }, 15000);

      it('should reject when both filter and ids are provided', async () => {
        await expect(
          config.vector.deleteVectors({
            indexName: testIndexName,
            filter: { source_id: 'doc.pdf' },
            ids: ['vec_1', 'vec_2'],
          }),
        ).rejects.toThrow(/mutually exclusive/i);
      }, 15000);

      it('should reject when neither filter nor ids are provided', async () => {
        await expect(
          config.vector.deleteVectors({
            indexName: testIndexName,
          }),
        ).rejects.toThrow(/Either filter or ids must be provided/i);
      }, 15000);
    }, 50000);

    describe('updateVector() with filter', () => {
      it('should update multiple vectors matching a filter', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [
            { userId: 'user_1', status: 'active' },
            { userId: 'user_1', status: 'active' },
            { userId: 'user_2', status: 'active' },
            { userId: 'user_2', status: 'active' },
          ],
        });

        await waitForIndexing(testIndexName);

        await config.vector.updateVector({
          indexName: testIndexName,
          filter: { userId: 'user_1' },
          update: { metadata: { userId: 'user_1', status: 'archived' } },
        });

        await waitForIndexing(testIndexName);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });

        const user1Vectors = results.filter(r => r.metadata?.userId === 'user_1');
        const user2Vectors = results.filter(r => r.metadata?.userId === 'user_2');

        expect(user1Vectors.every(v => v.metadata?.status === 'archived')).toBe(true);
        expect(user1Vectors.length).toBe(2);

        expect(user2Vectors.every(v => v.metadata?.status === 'active')).toBe(true);
        expect(user2Vectors.length).toBe(2);
      });

      it('should update vectors with complex filter', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [
            { tenant: 'acme', env: 'prod', version: 1 },
            { tenant: 'acme', env: 'dev', version: 1 },
            { tenant: 'globex', env: 'prod', version: 1 },
            { tenant: 'acme', env: 'prod', version: 2 },
          ],
        });

        await waitForIndexing(testIndexName);

        await config.vector.updateVector({
          indexName: testIndexName,
          filter: {
            $and: [{ tenant: 'acme' }, { env: 'prod' }, { version: 1 }],
          },
          update: { metadata: { tenant: 'acme', env: 'prod', version: 1, marked: true } },
        });

        await waitForIndexing(testIndexName);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });

        const markedVectors = results.filter(r => r.metadata?.marked === true);
        expect(markedVectors.length).toBe(1);
        expect(markedVectors[0]?.metadata?.tenant).toBe('acme');
        expect(markedVectors[0]?.metadata?.env).toBe('prod');
        expect(markedVectors[0]?.metadata?.version).toBe(1);
      });

      it('should update vectors when no matches exist', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1)],
          metadata: [{ name: 'vec1' }],
        });

        await waitForIndexing(testIndexName);

        await config.vector.updateVector({
          indexName: testIndexName,
          filter: { name: 'nonexistent' },
          update: { metadata: { name: 'nonexistent', updated: true } },
        });

        await waitForIndexing(testIndexName);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(1),
          topK: 1,
        });
        expect(results[0]?.metadata?.name).toBe('vec1');
        expect(results[0]?.metadata?.updated).toBeUndefined();
      });

      it('should reject when both id and filter are provided', async () => {
        // Note: The discriminated union type now prevents this at compile-time,
        // but we test runtime behavior for any non-TypeScript consumers
        await expect(
          config.vector.updateVector({
            indexName: testIndexName,
            id: 'vec_1',
            filter: { userId: 'user_1' },
            update: { metadata: { status: 'archived' } },
          } as any),
        ).rejects.toThrow(/mutually exclusive|not supported/i);
      });

      it('should reject when neither id nor filter are provided', async () => {
        // Note: The discriminated union type now requires either id or filter at compile-time,
        // but we test runtime behavior for any non-TypeScript consumers
        await expect(
          config.vector.updateVector({
            indexName: testIndexName,
            update: { metadata: { status: 'archived' } },
          } as any),
        ).rejects.toThrow(/Either id or filter must be provided|id is required/i);
      });

      it('should reject update with empty filter', async () => {
        await expect(
          config.vector.updateVector({
            indexName: testIndexName,
            filter: {},
            update: { metadata: { status: 'archived' } },
          }),
        ).rejects.toThrow(/empty filter/i);
      });
    }, 50000);

    describe('upsert() with deleteFilter', () => {
      it('should delete matching vectors before upserting new ones', async () => {
        // Initial upsert
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7)],
          metadata: [
            { source_id: 'doc.pdf', chunk: 0, content: 'old content 1' },
            { source_id: 'doc.pdf', chunk: 1, content: 'old content 2' },
            { source_id: 'doc.pdf', chunk: 2, content: 'old content 3' },
          ],
        });

        await waitForIndexing(testIndexName);

        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(3);

        // Re-upsert with deleteFilter - should delete old vectors and insert new ones atomically
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(2), createVector(5)],
          metadata: [
            { source_id: 'doc.pdf', chunk: 0, content: 'new content 1' },
            { source_id: 'doc.pdf', chunk: 1, content: 'new content 2' },
          ],
          deleteFilter: { source_id: 'doc.pdf' },
        });

        await waitForIndexing(testIndexName);

        // Should only have 2 vectors now (deleted 3 old, inserted 2 new)
        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(2);

        // Verify new content
        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(3),
          topK: 10,
        });
        expect(results.length).toBe(2);
        expect(results.every(r => r.metadata?.content?.startsWith('new content'))).toBe(true);
      });

      it('should only delete vectors matching the filter, not others', async () => {
        // Insert vectors for two different sources
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7)],
          metadata: [
            { source_id: 'doc1.pdf', chunk: 0 },
            { source_id: 'doc2.pdf', chunk: 0 },
            { source_id: 'doc2.pdf', chunk: 1 },
          ],
        });

        await waitForIndexing(testIndexName);

        // Re-upsert doc1.pdf only
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(2), createVector(5)],
          metadata: [
            { source_id: 'doc1.pdf', chunk: 0, updated: true },
            { source_id: 'doc1.pdf', chunk: 1, updated: true },
          ],
          deleteFilter: { source_id: 'doc1.pdf' },
        });

        await waitForIndexing(testIndexName);

        // Should have 4 vectors: 2 new doc1.pdf + 2 original doc2.pdf
        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(4);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(3),
          topK: 10,
        });

        const doc1Vectors = results.filter(r => r.metadata?.source_id === 'doc1.pdf');
        const doc2Vectors = results.filter(r => r.metadata?.source_id === 'doc2.pdf');

        expect(doc1Vectors.length).toBe(2);
        expect(doc1Vectors.every(r => r.metadata?.updated === true)).toBe(true);
        expect(doc2Vectors.length).toBe(2);
        expect(doc2Vectors.every(r => r.metadata?.updated)).toBe(false);
      });

      it('should work when deleteFilter matches no vectors', async () => {
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1)],
          metadata: [{ source_id: 'existing.pdf' }],
        });

        await waitForIndexing(testIndexName);

        // Upsert with deleteFilter that matches nothing
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(4)],
          metadata: [{ source_id: 'new.pdf' }],
          deleteFilter: { source_id: 'nonexistent.pdf' },
        });

        await waitForIndexing(testIndexName);

        // Should have 2 vectors (original + new)
        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);
      });

      it('should handle message content update scenario (issue #6195)', async () => {
        const messageId = 'msg-12345';

        // Initial message embedding
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1)],
          metadata: [{ message_id: messageId, content: 'I love pizza' }],
        });

        await waitForIndexing(testIndexName);

        // Update message with new content - should replace old embedding
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(9)], // Different vector for different content
          metadata: [{ message_id: messageId, content: 'I prefer salads' }],
          deleteFilter: { message_id: messageId },
        });

        await waitForIndexing(testIndexName);

        // Should only have 1 vector with new content
        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(9),
          topK: 1,
        });
        expect(results[0]?.metadata?.content).toBe('I prefer salads');
      });
    }, 50000);

    describe('Real-world scenarios', () => {
      it('should handle document re-indexing workflow', async () => {
        const docId = 'user-guide.pdf';

        // Initial document indexing
        const ids = await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7)],
          metadata: [
            { source_id: docId, chunk: 0 },
            { source_id: docId, chunk: 1 },
            { source_id: docId, chunk: 2 },
          ],
        });

        await waitForIndexing(testIndexName);

        expect(ids.length).toBe(3);
        const stats1 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(3);

        // Document updated - delete old vectors
        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: { source_id: docId },
        });

        await waitForIndexing(testIndexName);

        const stats2 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(0);

        // Re-index with new content (more chunks)
        const newIds = await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(2), createVector(5), createVector(8), createVector(3)],
          metadata: [
            { source_id: docId, chunk: 0 },
            { source_id: docId, chunk: 1 },
            { source_id: docId, chunk: 2 },
            { source_id: docId, chunk: 3 },
          ],
        });

        await waitForIndexing(testIndexName);

        expect(newIds.length).toBe(4);
        const stats3 = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats3.count).toBe(4);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        expect(results.every(r => r.metadata?.source_id === docId)).toBe(true);
      }, 55000);

      it('should handle multi-tenant data isolation with filters', async () => {
        // Insert vectors for multiple tenants
        await config.vector.upsert({
          indexName: testIndexName,
          vectors: [createVector(1), createVector(4), createVector(7), createVector(2)],
          metadata: [
            { tenant_id: 'tenant_a', doc: 'doc1.pdf' },
            { tenant_id: 'tenant_a', doc: 'doc2.pdf' },
            { tenant_id: 'tenant_b', doc: 'doc1.pdf' },
            { tenant_id: 'tenant_b', doc: 'doc2.pdf' },
          ],
        });

        await waitForIndexing(testIndexName);

        // Tenant A deletes all their data
        await config.vector.deleteVectors({
          indexName: testIndexName,
          filter: { tenant_id: 'tenant_a' },
        });

        await waitForIndexing(testIndexName);

        // Verify only tenant B data remains
        const stats = await config.vector.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);

        const results = await config.vector.query({
          indexName: testIndexName,
          queryVector: createVector(5),
          topK: 10,
        });
        expect(results.every(r => r.metadata?.tenant_id === 'tenant_b')).toBe(true);
      }, 15000);
    });
  }, 50000);
}
