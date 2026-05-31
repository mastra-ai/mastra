import { createVectorTestSuite } from '@internal/storage-test-utils';
import dotenv from 'dotenv';
import { describe, expect, it, vi } from 'vitest';

import { ConvexVector } from './index';

dotenv.config();

vi.setConfig({
  testTimeout: 180_000,
  hookTimeout: 180_000,
});

const deploymentUrl = process.env.CONVEX_TEST_URL;
const adminKey = process.env.CONVEX_TEST_ADMIN_KEY;
const storageFunction = process.env.CONVEX_TEST_STORAGE_FUNCTION;

describe('ConvexVector pagination', () => {
  const indexName = 'idx';
  const tableName = `mastra_vector_${indexName}`;

  function createVector({
    pages,
    indexes = [{ id: indexName, indexName, dimension: 2, metric: 'cosine' }],
  }: {
    pages: Array<Array<{ id: string; embedding: number[]; metadata?: Record<string, unknown> }>>;
    indexes?: Array<Record<string, unknown>>;
  }) {
    const vector = new ConvexVector({ id: 'test', deploymentUrl: 'http://localhost', adminAuthToken: 'test' });
    const requests: any[] = [];
    const inserted: any[] = [];
    const deletedIds: string[] = [];
    const rawPageForCursor = new Map<string | null, number>([[null, 0]]);

    const client = {
      callStorage: vi.fn(async (request: any) => {
        requests.push(request);
        if (request.op === 'load') return indexes.find(index => index.id === request.keys.id) ?? null;
        if (request.op === 'queryTable') return pages[0] ?? [];
        if (request.op === 'insert') {
          inserted.push(request.record);
          return undefined;
        }
        if (request.op === 'deleteMany') {
          deletedIds.push(...request.ids);
          return undefined;
        }
        throw new Error(`Unexpected callStorage op ${request.op}`);
      }),
      callStorageRaw: vi.fn(async (request: any) => {
        requests.push(request);
        if (request.op !== 'queryTable') throw new Error(`Unexpected callStorageRaw op ${request.op}`);

        const pageIndex = rawPageForCursor.get(request.cursor ?? null) ?? 0;
        const nextPageIndex = pageIndex + 1;
        const hasMore = nextPageIndex < pages.length;
        const continuationCursor = hasMore ? `cursor-${nextPageIndex}` : null;
        if (hasMore) rawPageForCursor.set(continuationCursor, nextPageIndex);

        return {
          result: pages[pageIndex] ?? [],
          hasMore,
          continuationCursor,
        };
      }),
    };

    (vector as any).client = client;
    return { vector, client, requests, inserted, deletedIds };
  }

  it('scores vectors from every query page', async () => {
    const { vector } = createVector({
      pages: [
        Array.from({ length: 3 }, (_, index) => ({
          id: `decoy-${index}`,
          embedding: [0, 1],
          metadata: { kind: 'decoy' },
        })),
        [{ id: 'perfect', embedding: [1, 0], metadata: { kind: 'match' } }],
      ],
    });

    const results = await vector.query({ indexName, queryVector: [1, 0], topK: 1 });

    expect(results[0]?.id).toBe('perfect');
  });

  it('counts vectors from every query page', async () => {
    const { vector } = createVector({
      pages: [
        Array.from({ length: 3 }, (_, index) => ({ id: `first-${index}`, embedding: [1, 0] })),
        Array.from({ length: 2 }, (_, index) => ({ id: `second-${index}`, embedding: [1, 0] })),
      ],
    });

    const stats = await vector.describeIndex({ indexName });

    expect(stats).toMatchObject({ dimension: 2, count: 5, metric: 'cosine' });
  });

  it('updates filter matches from later query pages', async () => {
    const { vector, inserted } = createVector({
      pages: [
        [{ id: 'first', embedding: [0, 1], metadata: { group: 'skip' } }],
        [{ id: 'second', embedding: [0, 1], metadata: { group: 'target', existing: true } }],
      ],
    });

    await vector.updateVector({
      indexName,
      filter: { metadata: { group: 'target' } },
      update: { metadata: { updated: true } },
    });

    expect(inserted).toEqual([
      {
        id: 'second',
        embedding: [0, 1],
        metadata: { group: 'target', existing: true, updated: true },
      },
    ]);
  });

  it('deletes filter matches from later query pages', async () => {
    const { vector, deletedIds } = createVector({
      pages: [
        [{ id: 'first', embedding: [0, 1], metadata: { group: 'skip' } }],
        [{ id: 'second', embedding: [0, 1], metadata: { group: 'target' } }],
      ],
    });

    await vector.deleteVectors({
      indexName,
      filter: { metadata: { group: 'target' } },
    });

    expect(deletedIds).toEqual(['second']);
  });

  it('queries the vector table when scanning pages', async () => {
    const { vector, requests } = createVector({
      pages: [[{ id: 'perfect', embedding: [1, 0] }]],
    });

    await vector.query({ indexName, queryVector: [1, 0], topK: 1 });

    expect(requests).toContainEqual(
      expect.objectContaining({
        op: 'queryTable',
        tableName,
      }),
    );
  });

  it('throws when storage reports more pages without advancing the cursor', async () => {
    const { vector, client } = createVector({
      pages: [[{ id: 'first', embedding: [1, 0] }], [{ id: 'second', embedding: [1, 0] }]],
    });
    client.callStorageRaw.mockResolvedValueOnce({
      result: [{ id: 'first', embedding: [1, 0] }],
      hasMore: true,
      continuationCursor: null,
    });

    await expect(vector.query({ indexName, queryVector: [1, 0], topK: 1 })).rejects.toThrow(
      'ConvexVector: paginated vector query did not return a valid continuation cursor',
    );
  });
});

if (!deploymentUrl || !adminKey) {
  describe.skip('ConvexVector', () => {
    it('requires CONVEX_TEST_URL and CONVEX_TEST_ADMIN_KEY to run integration tests', () => undefined);
  });
} else {
  const vector = new ConvexVector({
    id: 'convex-vector-test',
    deploymentUrl,
    adminAuthToken: adminKey,
    ...(storageFunction ? { storageFunction } : {}),
  });

  createVectorTestSuite({
    vector,
    createIndex: async indexName => {
      await vector.createIndex({ indexName, dimension: 1536 });
    },
    deleteIndex: async indexName => {
      try {
        await vector.deleteIndex({ indexName });
      } catch {
        // ignore
      }
    },
  });
}
