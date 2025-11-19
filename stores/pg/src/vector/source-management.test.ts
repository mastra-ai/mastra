import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { PgVector } from '.';

/**
 * Comprehensive test suite for source-based vector management.
 * Tests cover:
 * - Basic deleteVectorsByFilter() functionality
 * - upsert() with deleteFilter parameter
 * - Real-world scenarios (RAG workflows)
 * - Performance with large datasets
 * - Concurrency and edge cases
 *
 * Tests run against a real PostgreSQL database with pgvector extension.
 */
describe('PgVector - Source Management', () => {
  let vectorDB: PgVector;
  const testIndexName = 'test_source_management';
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

  beforeAll(async () => {
    vectorDB = new PgVector({ connectionString, id: 'pg-vector-source-test' });

    // Create test index
    await vectorDB.createIndex({
      indexName: testIndexName,
      dimension: 3,
      metric: 'cosine',
    });
  });

  afterAll(async () => {
    // Clean up
    try {
      await vectorDB.deleteIndex({ indexName: testIndexName });
    } catch {}
    await vectorDB.disconnect();
  });

  beforeEach(async () => {
    // Clear all vectors before each test
    const client = await vectorDB.pool.connect();
    try {
      const { tableName } = vectorDB['getTableName'](testIndexName);
      await client.query(`DELETE FROM ${tableName}`);
    } finally {
      client.release();
    }
  });

  describe('deleteVectorsByFilter()', () => {
    describe('Basic Functionality', () => {
      it('should delete vectors matching a simple source_id filter', async () => {
        // Insert vectors with different source_ids
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { text: 'doc1 chunk1', source_id: 'doc1.pdf' },
            { text: 'doc1 chunk2', source_id: 'doc1.pdf' },
            { text: 'doc2 chunk1', source_id: 'doc2.pdf' },
          ],
          ids: ['id1', 'id2', 'id3'],
        });

        // Verify all vectors exist
        const stats1 = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats1.count).toBe(3);

        // Delete vectors from doc1.pdf
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: { source_id: 'doc1.pdf' },
        });

        // Verify only doc2 vectors remain
        const stats2 = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats2.count).toBe(1);

        // Verify the remaining vector is from doc2
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.7, 0.8, 0.9],
          topK: 10,
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.metadata?.source_id).toBe('doc2.pdf');
      });

      it('should delete nothing when filter matches no vectors', async () => {
        // Insert vectors
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ source_id: 'doc1.pdf' }],
          ids: ['id1'],
        });

        // Try to delete with non-matching filter
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: { source_id: 'nonexistent.pdf' },
        });

        // Verify vector still exists
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);
      });

      it('should throw error on empty filter', async () => {
        // Empty filter should throw to prevent accidental deletion of all vectors
        await expect(
          vectorDB.deleteVectorsByFilter({
            indexName: testIndexName,
            filter: {},
          }),
        ).rejects.toThrow(/empty filter/i);
      });
    });

    describe('Complex Filters', () => {
      it('should delete vectors matching $and filter', async () => {
        // Insert vectors with multiple metadata fields
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
            [0.2, 0.3, 0.4],
          ],
          metadata: [
            { source_id: 'doc1.pdf', bucket: 'public' },
            { source_id: 'doc2.pdf', bucket: 'public' },
            { source_id: 'doc3.pdf', bucket: 'private' },
            { source_id: 'doc1.pdf', bucket: 'private' },
          ],
          ids: ['id1', 'id2', 'id3', 'id4'],
        });

        // Delete only doc1.pdf from public bucket
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: {
            $and: [{ source_id: 'doc1.pdf' }, { bucket: 'public' }],
          },
        });

        // Should have 3 vectors left (doc2 public, doc3 private, doc1 private)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(3);

        // Verify doc1 private still exists
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.2, 0.3, 0.4],
          topK: 1,
        });
        expect(results[0]?.metadata?.source_id).toBe('doc1.pdf');
        expect(results[0]?.metadata?.bucket).toBe('private');
      });

      it('should delete vectors matching $or filter', async () => {
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [{ source_id: 'doc1.pdf' }, { source_id: 'doc2.pdf' }, { source_id: 'doc3.pdf' }],
          ids: ['id1', 'id2', 'id3'],
        });

        // Delete doc1 OR doc2
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: {
            $or: [{ source_id: 'doc1.pdf' }, { source_id: 'doc2.pdf' }],
          },
        });

        // Should have 1 vector left (doc3)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.7, 0.8, 0.9],
          topK: 1,
        });
        expect(results[0]?.metadata?.source_id).toBe('doc3.pdf');
      });

      it('should delete vectors with $in filter', async () => {
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
            [0.2, 0.3, 0.4],
          ],
          metadata: [
            { source_id: 'doc1.pdf' },
            { source_id: 'doc2.pdf' },
            { source_id: 'doc3.pdf' },
            { source_id: 'doc4.pdf' },
          ],
          ids: ['id1', 'id2', 'id3', 'id4'],
        });

        // Delete multiple sources at once
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: {
            source_id: { $in: ['doc1.pdf', 'doc3.pdf', 'doc4.pdf'] },
          },
        });

        // Should have 1 vector left (doc2)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);
      });

      it('should delete vectors with comparison operators', async () => {
        const now = new Date().toISOString();
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { source_id: 'doc1.pdf', indexed_at: now },
            { source_id: 'doc2.pdf', indexed_at: yesterday },
            { source_id: 'doc3.pdf', indexed_at: lastWeek },
          ],
          ids: ['id1', 'id2', 'id3'],
        });

        // Delete old documents (older than yesterday)
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: {
            indexed_at: { $lt: yesterday },
          },
        });

        // Should have 2 vectors left (now and yesterday)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);
      });
    });

    describe('Multi-Tenancy Use Cases', () => {
      it('should support tenant isolation in deletion', async () => {
        // Insert vectors for multiple tenants
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
            [0.2, 0.3, 0.4],
          ],
          metadata: [
            { tenant_id: 'acme', source_id: 'report.pdf' },
            { tenant_id: 'acme', source_id: 'manual.pdf' },
            { tenant_id: 'globex', source_id: 'report.pdf' },
            { tenant_id: 'globex', source_id: 'manual.pdf' },
          ],
          ids: ['id1', 'id2', 'id3', 'id4'],
        });

        // Delete only acme's report
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: {
            $and: [{ tenant_id: 'acme' }, { source_id: 'report.pdf' }],
          },
        });

        // Should have 3 vectors left
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(3);

        // Verify globex's report still exists
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.7, 0.8, 0.9],
          topK: 1,
        });
        expect(results[0]?.metadata?.tenant_id).toBe('globex');
        expect(results[0]?.metadata?.source_id).toBe('report.pdf');
      });

      it('should delete all documents for a tenant', async () => {
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { tenant_id: 'acme', source_id: 'doc1.pdf' },
            { tenant_id: 'acme', source_id: 'doc2.pdf' },
            { tenant_id: 'globex', source_id: 'doc1.pdf' },
          ],
          ids: ['id1', 'id2', 'id3'],
        });

        // Delete all of acme's documents
        await vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: { tenant_id: 'acme' },
        });

        // Should have 1 vector left (globex)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for invalid index name', async () => {
        await expect(
          vectorDB.deleteVectorsByFilter({
            indexName: 'nonexistent_index',
            filter: { source_id: 'doc.pdf' },
          }),
        ).rejects.toThrow();
      });

      it('should handle filters that produce invalid SQL gracefully', async () => {
        // This should be caught and thrown as a MastraError
        await expect(
          vectorDB.deleteVectorsByFilter({
            indexName: testIndexName,
            filter: null as any,
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('upsert() with deleteFilter', () => {
    describe('Basic Delete-Then-Insert Pattern', () => {
      it('should delete old chunks and insert new ones atomically', async () => {
        // Initial upsert - 3 chunks from doc1.pdf
        const ids1 = await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { text: 'chunk1 v1', source_id: 'doc1.pdf', version: 1 },
            { text: 'chunk2 v1', source_id: 'doc1.pdf', version: 1 },
            { text: 'chunk3 v1', source_id: 'doc1.pdf', version: 1 },
          ],
        });

        expect(ids1).toHaveLength(3);

        // Update document - now only 2 chunks, with deleteFilter
        const ids2 = await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.11, 0.22, 0.33],
            [0.44, 0.55, 0.66],
          ],
          metadata: [
            { text: 'chunk1 v2', source_id: 'doc1.pdf', version: 2 },
            { text: 'chunk2 v2', source_id: 'doc1.pdf', version: 2 },
          ],
          deleteFilter: { source_id: 'doc1.pdf' },
        });

        expect(ids2).toHaveLength(2);

        // Verify only 2 vectors exist (old ones deleted)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);

        // Verify the vectors are version 2
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.11, 0.22, 0.33],
          topK: 10,
        });

        expect(results).toHaveLength(2);
        expect(results.every(r => r.metadata?.version === 2)).toBe(true);
        expect(results.every(r => r.metadata?.source_id === 'doc1.pdf')).toBe(true);
      });

      it('should not affect other sources when updating one source', async () => {
        // Insert vectors for two sources
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
          ],
          metadata: [
            { text: 'doc1 chunk1', source_id: 'doc1.pdf' },
            { text: 'doc1 chunk2', source_id: 'doc1.pdf' },
            { text: 'doc2 chunk1', source_id: 'doc2.pdf' },
          ],
        });

        // Update doc1 with deleteFilter
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.11, 0.22, 0.33]],
          metadata: [{ text: 'doc1 updated', source_id: 'doc1.pdf' }],
          deleteFilter: { source_id: 'doc1.pdf' },
        });

        // Should have 2 vectors (1 new doc1, 1 original doc2)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);

        // Verify doc2 still exists unchanged
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.7, 0.8, 0.9],
          topK: 1,
        });
        expect(results[0]?.metadata?.source_id).toBe('doc2.pdf');
        expect(results[0]?.metadata?.text).toBe('doc2 chunk1');
      });
    });

    describe('Transaction Safety', () => {
      it('should rollback both delete and insert on error', async () => {
        // Insert initial vectors
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ source_id: 'doc1.pdf' }],
          ids: ['id1'],
        });

        // Try to upsert with deleteFilter but with invalid vectors (wrong dimension)
        await expect(
          vectorDB.upsert({
            indexName: testIndexName,
            vectors: [[0.1, 0.2]], // Wrong dimension - should fail
            metadata: [{ source_id: 'doc1.pdf' }],
            deleteFilter: { source_id: 'doc1.pdf' },
          }),
        ).rejects.toThrow();

        // Original vector should still exist (rollback worked)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(1);

        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 1,
        });
        expect(results[0]?.id).toBe('id1');
      });
    });

    describe('Complex Filter Scenarios', () => {
      it('should work with complex deleteFilter', async () => {
        // Insert vectors with multiple metadata fields
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
            [0.2, 0.3, 0.4],
          ],
          metadata: [
            { source_id: 'doc1.pdf', tenant_id: 'acme', version: 1 },
            { source_id: 'doc2.pdf', tenant_id: 'acme', version: 1 },
            { source_id: 'doc1.pdf', tenant_id: 'globex', version: 1 },
            { source_id: 'doc3.pdf', tenant_id: 'acme', version: 1 },
          ],
        });

        // Update doc1.pdf for acme tenant only
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.11, 0.22, 0.33]],
          metadata: [{ source_id: 'doc1.pdf', tenant_id: 'acme', version: 2 }],
          deleteFilter: {
            $and: [{ source_id: 'doc1.pdf' }, { tenant_id: 'acme' }],
          },
        });

        // Should have 4 vectors (acme: doc1v2, doc2v1, doc3v1; globex: doc1v1)
        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(4);

        // Verify globex's doc1 still exists
        const results = await vectorDB.query({
          indexName: testIndexName,
          queryVector: [0.7, 0.8, 0.9], // This is globex's doc1.pdf vector
          topK: 1,
        });
        expect(results[0]?.metadata?.tenant_id).toBe('globex');
        expect(results[0]?.metadata?.source_id).toBe('doc1.pdf');
        expect(results[0]?.metadata?.version).toBe(1);
      });
    });

    describe('Backward Compatibility', () => {
      it('should work normally without deleteFilter', async () => {
        // Regular upsert without deleteFilter should work as before
        const ids = await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
          ],
          metadata: [{ source_id: 'doc1.pdf' }, { source_id: 'doc2.pdf' }],
        });

        expect(ids).toHaveLength(2);

        const stats = await vectorDB.describeIndex({ indexName: testIndexName });
        expect(stats.count).toBe(2);
      });

      it('should handle undefined deleteFilter', async () => {
        const ids = await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.1, 0.2, 0.3]],
          metadata: [{ source_id: 'doc1.pdf' }],
          deleteFilter: undefined,
        });

        expect(ids).toHaveLength(1);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle document re-indexing workflow', async () => {
      // Simulate a complete RAG workflow for a document

      // Step 1: Initial indexing of document v1 (3 chunks)
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ],
        metadata: [
          { text: 'Introduction to AI', source_id: 'ai-guide.pdf', chunk_index: 0 },
          { text: 'Machine Learning basics', source_id: 'ai-guide.pdf', chunk_index: 1 },
          { text: 'Neural networks', source_id: 'ai-guide.pdf', chunk_index: 2 },
        ],
      });

      const stats1 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats1.count).toBe(3);

      // Step 2: Document updated, now has 2 chunks with different content
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.11, 0.22, 0.33],
          [0.44, 0.55, 0.66],
        ],
        metadata: [
          { text: 'AI Overview - Updated', source_id: 'ai-guide.pdf', chunk_index: 0 },
          { text: 'ML and DL basics', source_id: 'ai-guide.pdf', chunk_index: 1 },
        ],
        deleteFilter: { source_id: 'ai-guide.pdf' },
      });

      // Verify old chunks are gone, new chunks exist
      const stats2 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats2.count).toBe(2);

      // Step 3: Document deleted entirely
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: { source_id: 'ai-guide.pdf' },
      });

      const stats3 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats3.count).toBe(0);
    });

    it('should handle multi-tenant document management', async () => {
      // Tenant A uploads document
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        metadata: [
          { text: 'chunk1', tenant_id: 'tenant-a', source_id: 'report.pdf' },
          { text: 'chunk2', tenant_id: 'tenant-a', source_id: 'report.pdf' },
        ],
      });

      // Tenant B uploads document with same name
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.7, 0.8, 0.9],
          [0.2, 0.3, 0.4],
        ],
        metadata: [
          { text: 'chunk1', tenant_id: 'tenant-b', source_id: 'report.pdf' },
          { text: 'chunk2', tenant_id: 'tenant-b', source_id: 'report.pdf' },
        ],
      });

      // Both tenants have 2 chunks each
      const stats1 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats1.count).toBe(4);

      // Tenant A updates their document
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [[0.11, 0.22, 0.33]],
        metadata: [{ text: 'updated chunk', tenant_id: 'tenant-a', source_id: 'report.pdf' }],
        deleteFilter: {
          $and: [{ tenant_id: 'tenant-a' }, { source_id: 'report.pdf' }],
        },
      });

      // Should have 3 total (1 tenant-a, 2 tenant-b)
      const stats2 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats2.count).toBe(3);

      // Verify tenant B's documents unchanged
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.7, 0.8, 0.9],
        topK: 10,
        filter: { tenant_id: 'tenant-b' },
      });
      expect(results).toHaveLength(2);
    });

    it('should handle temporal cleanup of old documents', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const lastWeek = new Date(now.getTime() - 7 * 86400000);
      const lastMonth = new Date(now.getTime() - 30 * 86400000);

      // Insert documents with different timestamps
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
          [0.2, 0.3, 0.4],
        ],
        metadata: [
          { source_id: 'recent.pdf', indexed_at: now.toISOString(), bucket: 'temp' },
          { source_id: 'yesterday.pdf', indexed_at: yesterday.toISOString(), bucket: 'temp' },
          { source_id: 'old.pdf', indexed_at: lastWeek.toISOString(), bucket: 'temp' },
          { source_id: 'ancient.pdf', indexed_at: lastMonth.toISOString(), bucket: 'temp' },
        ],
      });

      // Delete temp documents older than 3 days
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: {
          $and: [{ bucket: 'temp' }, { indexed_at: { $lt: threeDaysAgo.toISOString() } }],
        },
      });

      // Should have 2 vectors left (recent and yesterday)
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(2);
    });
  });

  describe('Performance Tests', () => {
    it('should handle deletion of large dataset efficiently', async () => {
      const vectorCount = 1000;
      const vectors: number[][] = [];
      const metadata: Record<string, any>[] = [];

      // Generate test data
      for (let i = 0; i < vectorCount; i++) {
        vectors.push([Math.random(), Math.random(), Math.random()]);
        metadata.push({
          source_id: i < 500 ? 'doc1.pdf' : 'doc2.pdf',
          chunk_index: i,
        });
      }

      // Insert vectors
      const insertStart = Date.now();
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
      });
      const insertTime = Date.now() - insertStart;

      console.log(`Inserted ${vectorCount} vectors in ${insertTime}ms`);

      // Verify all inserted
      const stats1 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats1.count).toBe(vectorCount);

      // Delete half by filter
      const deleteStart = Date.now();
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: { source_id: 'doc1.pdf' },
      });
      const deleteTime = Date.now() - deleteStart;

      console.log(`Deleted 500 vectors by filter in ${deleteTime}ms`);

      // Verify only half remain
      const stats2 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats2.count).toBe(500);

      // Performance expectations (should be reasonably fast)
      expect(deleteTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle upsert with deleteFilter on large dataset', async () => {
      const vectorCount = 500;
      const vectors1: number[][] = [];
      const metadata1: Record<string, any>[] = [];

      // Generate initial dataset
      for (let i = 0; i < vectorCount; i++) {
        vectors1.push([Math.random(), Math.random(), Math.random()]);
        metadata1.push({
          source_id: 'large-doc.pdf',
          version: 1,
          chunk_index: i,
        });
      }

      // Initial upsert
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: vectors1,
        metadata: metadata1,
      });

      const stats1 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats1.count).toBe(vectorCount);

      // Update with fewer chunks (250) - should delete old 500, insert new 250
      const vectors2: number[][] = [];
      const metadata2: Record<string, any>[] = [];

      for (let i = 0; i < 250; i++) {
        vectors2.push([Math.random(), Math.random(), Math.random()]);
        metadata2.push({
          source_id: 'large-doc.pdf',
          version: 2,
          chunk_index: i,
        });
      }

      const updateStart = Date.now();
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: vectors2,
        metadata: metadata2,
        deleteFilter: { source_id: 'large-doc.pdf' },
      });
      const updateTime = Date.now() - updateStart;

      console.log(`Updated document (500->250 chunks) in ${updateTime}ms`);

      // Verify correct count
      const stats2 = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats2.count).toBe(250);

      // Verify all are version 2
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 10,
      });
      expect(results.every(r => r.metadata?.version === 2)).toBe(true);
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent upserts with same source_id safely', async () => {
      // This tests that transaction isolation works correctly
      // Note: Due to transaction isolation, some concurrent operations may complete
      // before others can delete their results. This is correct behavior.
      const promises: Promise<string[]>[] = [];

      // Multiple concurrent updates to the same source
      for (let i = 0; i < 5; i++) {
        promises.push(
          vectorDB.upsert({
            indexName: testIndexName,
            vectors: [[0.1 * i, 0.2 * i, 0.3 * i]],
            metadata: [
              {
                source_id: 'concurrent-doc.pdf',
                version: i,
                timestamp: Date.now(),
              },
            ],
            deleteFilter: { source_id: 'concurrent-doc.pdf' },
          }),
        );
      }

      // Wait for all to complete
      await Promise.all(promises);

      // Due to concurrent execution and transaction isolation, we may have 1-5 vectors
      // (some transactions complete before others can delete their results)
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBeGreaterThanOrEqual(1);
      expect(stats.count).toBeLessThanOrEqual(5);

      // All remaining vectors should be from the same source
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 10,
      });
      expect(results.length).toBe(stats.count);
      expect(results.every(r => r.metadata?.source_id === 'concurrent-doc.pdf')).toBe(true);

      // Versions should be valid (0-4)
      results.forEach(r => {
        expect(r.metadata?.version).toBeGreaterThanOrEqual(0);
        expect(r.metadata?.version).toBeLessThanOrEqual(4);
      });
    });

    it('should handle concurrent updates to different sources safely', async () => {
      const promises: Promise<string[]>[] = [];

      // Multiple concurrent updates to different sources
      for (let i = 0; i < 10; i++) {
        promises.push(
          vectorDB.upsert({
            indexName: testIndexName,
            vectors: [[0.1 * i, 0.2 * i, 0.3 * i]],
            metadata: [
              {
                source_id: `doc${i}.pdf`,
                version: 1,
              },
            ],
            deleteFilter: { source_id: `doc${i}.pdf` },
          }),
        );
      }

      // Wait for all to complete
      await Promise.all(promises);

      // Should have exactly 10 vectors (one per source)
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(10);
    });

    it('should handle concurrent deletes and inserts', async () => {
      // Insert initial data
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ],
        metadata: [
          { source_id: 'doc1.pdf', type: 'A' },
          { source_id: 'doc2.pdf', type: 'B' },
          { source_id: 'doc3.pdf', type: 'A' },
        ],
      });

      const promises: Array<Promise<void> | Promise<string[]>> = [];

      // Concurrent delete and insert operations
      promises.push(
        vectorDB.deleteVectorsByFilter({
          indexName: testIndexName,
          filter: { type: 'A' },
        }),
      );

      promises.push(
        vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.11, 0.22, 0.33]],
          metadata: [{ source_id: 'doc4.pdf', type: 'C' }],
        }),
      );

      promises.push(
        vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[0.44, 0.55, 0.66]],
          metadata: [{ source_id: 'doc5.pdf', type: 'C' }],
        }),
      );

      await Promise.all(promises);

      // Should have 3 vectors: doc2 (type B) + doc4 (type C) + doc5 (type C)
      // The type A vectors should be deleted
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBeGreaterThanOrEqual(1); // At least one should survive
      expect(stats.count).toBeLessThanOrEqual(4); // But not all if delete completed

      // Verify type A is gone
      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 10,
      });
      const typeACount = results.filter(r => r.metadata?.type === 'A').length;
      expect(typeACount).toBe(0); // No type A should remain
    });
  });

  describe('Edge Cases', () => {
    it('should handle filter with no matches gracefully', async () => {
      // Insert some data
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ source_id: 'doc1.pdf' }],
      });

      // Try to delete with non-matching filter (should not error, just delete nothing)
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: { source_id: 'nonexistent.pdf' },
      });

      // Original vector should still exist
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(1);
    });

    it('should handle very complex nested filters', async () => {
      // Insert test data with multiple metadata fields
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
          [0.2, 0.3, 0.4],
          [0.5, 0.6, 0.7],
        ],
        metadata: [
          { source_id: 'doc1.pdf', tenant: 'acme', env: 'prod', version: 1 },
          { source_id: 'doc2.pdf', tenant: 'acme', env: 'dev', version: 1 },
          { source_id: 'doc3.pdf', tenant: 'globex', env: 'prod', version: 2 },
          { source_id: 'doc4.pdf', tenant: 'globex', env: 'dev', version: 1 },
          { source_id: 'doc5.pdf', tenant: 'acme', env: 'prod', version: 2 },
        ],
      });

      // Complex nested filter: (tenant=acme AND env=prod) OR (tenant=globex AND version=2)
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: {
          $or: [
            {
              $and: [{ tenant: 'acme' }, { env: 'prod' }],
            },
            {
              $and: [{ tenant: 'globex' }, { version: 2 }],
            },
          ],
        },
      });

      // Should delete doc1 (acme+prod), doc5 (acme+prod), doc3 (globex+v2)
      // Should keep doc2 (acme+dev), doc4 (globex+dev+v1)
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(2);

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 10,
      });

      const sources = results.map(r => r.metadata?.source_id).sort();
      expect(sources).toEqual(['doc2.pdf', 'doc4.pdf']);
    });

    it('should handle metadata field that does not exist', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ source_id: 'doc1.pdf' }],
      });

      // Try to filter on non-existent field (should not match, not error)
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: { nonexistent_field: 'value' },
      });

      // Should not delete anything
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(1);
    });

    it('should handle upsert with deleteFilter when no previous vectors exist', async () => {
      // This should work fine - just insert without deleting anything
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ source_id: 'new-doc.pdf' }],
        deleteFilter: { source_id: 'new-doc.pdf' }, // Nothing to delete, that's ok
      });

      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(1);
    });

    it('should handle null/undefined values in metadata filters', async () => {
      await vectorDB.upsert({
        indexName: testIndexName,
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        metadata: [{ source_id: 'doc1.pdf', optional_field: 'value' }, { source_id: 'doc2.pdf' }],
      });

      // Delete where optional_field exists
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: { optional_field: { $exists: true } },
      });

      // Should delete doc1, keep doc2
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(1);

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 1,
      });
      expect(results[0]?.metadata?.source_id).toBe('doc2.pdf');
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid sequential upserts with deleteFilter', async () => {
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await vectorDB.upsert({
          indexName: testIndexName,
          vectors: [[Math.random(), Math.random(), Math.random()]],
          metadata: [{ source_id: 'rapidly-updated-doc.pdf', version: i }],
          deleteFilter: { source_id: 'rapidly-updated-doc.pdf' },
        });
      }

      // Should have exactly 1 vector (the latest version)
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBe(1);

      const results = await vectorDB.query({
        indexName: testIndexName,
        queryVector: [0.5, 0.5, 0.5],
        topK: 1,
      });
      expect(results[0]?.metadata?.version).toBe(iterations - 1);
    });

    it('should handle multiple filters with many conditions', async () => {
      // Insert data with many metadata fields
      const vectors: number[][] = [];
      const metadata: Record<string, any>[] = [];

      for (let i = 0; i < 100; i++) {
        vectors.push([Math.random(), Math.random(), Math.random()]);
        metadata.push({
          source_id: `doc${i}.pdf`,
          category: i % 5,
          priority: i % 3,
          status: i % 2 === 0 ? 'active' : 'inactive',
          tag: `tag${i % 10}`,
        });
      }

      await vectorDB.upsert({
        indexName: testIndexName,
        vectors,
        metadata,
      });

      // Complex filter with multiple conditions
      await vectorDB.deleteVectorsByFilter({
        indexName: testIndexName,
        filter: {
          $and: [
            { category: { $in: [0, 1, 2] } },
            { priority: { $ne: 2 } },
            { status: 'active' },
            { tag: { $in: ['tag0', 'tag1', 'tag2', 'tag3'] } },
          ],
        },
      });

      // Verify some vectors remain
      const stats = await vectorDB.describeIndex({ indexName: testIndexName });
      expect(stats.count).toBeGreaterThan(0);
      expect(stats.count).toBeLessThan(100);
    });
  });
});
