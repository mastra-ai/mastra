import { describe, expect, it, vi } from 'vitest';

import type { ObservabilityContext } from '../observability';
import type { UpsertVectorParams, QueryResult, IndexStats, CreateIndexParams } from './types';
import { MastraVector } from './vector';

// Concrete subclass for testing
class TestVector extends MastraVector {
  upsertMock = vi.fn<(params: UpsertVectorParams) => Promise<string[]>>();

  async query(): Promise<QueryResult[]> {
    return [];
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    return this.upsertMock(params);
  }

  async createIndex(_params: CreateIndexParams): Promise<void> {}
  async listIndexes(): Promise<string[]> {
    return [];
  }
  async describeIndex(): Promise<IndexStats> {
    return { dimension: 3, count: 0 };
  }
  async deleteIndex(): Promise<void> {}
  async updateVector(): Promise<void> {}
  async deleteVector(): Promise<void> {}
  async deleteVectors(): Promise<void> {}
}

function createMockObservabilityContext() {
  const endFn = vi.fn();
  const errorFn = vi.fn();
  const createChildSpanFn = vi.fn().mockReturnValue({
    end: endFn,
    error: errorFn,
  });

  const ctx: ObservabilityContext = {
    tracingContext: {
      currentSpan: {
        createChildSpan: createChildSpanFn,
      },
    },
  } as any;

  return { ctx, createChildSpanFn, endFn, errorFn };
}

describe('MastraVector.upsertWithTracing', () => {
  it('delegates to upsert() without observabilityContext', async () => {
    const vector = new TestVector({ id: 'test-store' });
    vector.upsertMock.mockResolvedValueOnce(['id-1', 'id-2']);

    const params: UpsertVectorParams = {
      indexName: 'docs',
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    };

    const ids = await vector.upsertWithTracing(params);

    expect(ids).toEqual(['id-1', 'id-2']);
    expect(vector.upsertMock).toHaveBeenCalledWith(params);
  });

  it('creates a child span with correct attributes when observabilityContext is provided', async () => {
    const vector = new TestVector({ id: 'test-pgvector' });
    vector.upsertMock.mockResolvedValueOnce(['id-1', 'id-2', 'id-3']);

    const { ctx, createChildSpanFn, endFn } = createMockObservabilityContext();

    const params: UpsertVectorParams = {
      indexName: 'my-index',
      vectors: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    };

    const ids = await vector.upsertWithTracing(params, { observabilityContext: ctx });

    expect(ids).toEqual(['id-1', 'id-2', 'id-3']);

    expect(createChildSpanFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'rag vector: upsert',
        input: { indexName: 'my-index', vectorCount: 3 },
        attributes: expect.objectContaining({
          operation: 'upsert',
          store: 'test-pgvector',
          indexName: 'my-index',
          dimensions: 3,
        }),
      }),
    );

    expect(endFn).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { vectorCount: 3 },
      }),
    );
  });

  it('records error on span and re-throws when upsert fails', async () => {
    const vector = new TestVector({ id: 'test-store' });
    const error = new Error('upsert failed');
    vector.upsertMock.mockRejectedValueOnce(error);

    const { ctx, errorFn } = createMockObservabilityContext();

    await expect(
      vector.upsertWithTracing({ indexName: 'docs', vectors: [[1, 2, 3]] }, { observabilityContext: ctx }),
    ).rejects.toThrow('upsert failed');

    expect(errorFn).toHaveBeenCalledWith({ error, endSpan: true });
  });
});
