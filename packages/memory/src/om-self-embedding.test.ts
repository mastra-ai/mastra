import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, it, expect, vi } from 'vitest';
import { Memory } from './index';

/**
 * Observational Memory retrieval against a vector store that embeds server-side. The store
 * receives the observation text on write and the search string on query, so no embedder is
 * configured on the Memory.
 */

const makeSelfEmbeddingVector = (): MastraVector => {
  const vector = {
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    listIndexes: vi.fn().mockResolvedValue([]),
    deleteVectors: vi.fn().mockResolvedValue(undefined),
    describeIndex: vi.fn(),
    id: 'mock-vector',
  } as any;
  vector.isSelfEmbedding = true;
  return vector;
};

const makeMemory = (vector = makeSelfEmbeddingVector()) =>
  new Memory({
    storage: new InMemoryStore(),
    vector,
    options: { observationalMemory: { retrieval: { vector: true } } },
  });

const observation = {
  text: 'The team agreed to move the onboarding session to the second week of June.',
  groupId: 'group-1',
  range: 'message-1:message-2',
  threadId: 'thread-1',
  resourceId: 'resource-1',
  observedAt: new Date('2026-06-01T10:00:00.000Z'),
  recordId: 'record-1',
};

describe('observational memory retrieval on a store that embeds server-side', () => {
  it('constructs without an embedder', () => {
    expect(() => makeMemory()).not.toThrow();
  });

  it('still requires an embedder when the store does not embed server-side', () => {
    const vector = makeSelfEmbeddingVector();
    (vector as any).isSelfEmbedding = false;

    expect(() => makeMemory(vector)).toThrow(/requires an embedder/);
  });

  it('names both routes to embeddings when neither is configured', () => {
    const vector = makeSelfEmbeddingVector();
    (vector as any).isSelfEmbedding = false;

    expect(() => makeMemory(vector)).toThrow(/vector store that generates embeddings itself/);
  });

  it('reports retrieval search as available', () => {
    const memory = makeMemory();

    expect(memory.hasRetrievalSearch({ vector: true })).toBe(true);
  });

  it('indexes the observation text without a dimension', async () => {
    const vector = makeSelfEmbeddingVector();
    const memory = makeMemory(vector);

    await memory.indexObservation(observation);

    expect(vector.createIndex).toHaveBeenCalledWith({ indexName: 'memory_observations_selfembed' });
    expect(vector.upsert).toHaveBeenCalledTimes(1);
    const params = vi.mocked(vector.upsert).mock.calls[0]![0] as any;
    expect(params.indexName).toBe('memory_observations_selfembed');
    expect(params.documents).toEqual([observation.text]);
    expect(params.vectors).toBeUndefined();
  });

  it('stores the same metadata as the client-side path, one entry per document', async () => {
    const vector = makeSelfEmbeddingVector();
    const memory = makeMemory(vector);

    await memory.indexObservation(observation);

    const params = vi.mocked(vector.upsert).mock.calls[0]![0] as any;
    expect(params.metadata).toEqual([
      {
        group_id: 'group-1',
        range: 'message-1:message-2',
        thread_id: 'thread-1',
        resource_id: 'resource-1',
        observed_at: '2026-06-01T10:00:00.000Z',
        record_id: 'record-1',
        text: observation.text,
      },
    ]);
    expect(params.ids).toHaveLength(1);
  });

  it('derives the same row ids on every attempt', async () => {
    const first = makeSelfEmbeddingVector();
    const second = makeSelfEmbeddingVector();

    await makeMemory(first).indexObservation(observation);
    await makeMemory(second).indexObservation(observation);

    const firstIds = (vi.mocked(first.upsert).mock.calls[0]![0] as any).ids;
    const secondIds = (vi.mocked(second.upsert).mock.calls[0]![0] as any).ids;
    expect(firstIds).toEqual(secondIds);
    expect(firstIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('writes nothing for an observation without text', async () => {
    const vector = makeSelfEmbeddingVector();
    const memory = makeMemory(vector);

    await memory.indexObservation({ ...observation, text: '' });

    expect(vector.upsert).not.toHaveBeenCalled();
  });

  it('sends the search string and filter to the store as text', async () => {
    const vector = makeSelfEmbeddingVector();
    vi.mocked(vector.query).mockResolvedValue([
      {
        id: 'v1',
        score: 0.9,
        metadata: { group_id: 'group-1', thread_id: 'thread-1', record_id: 'record-1', text: 'x' },
      },
    ]);
    const memory = makeMemory(vector);

    const { results } = await memory.searchMessages({
      query: 'What deadline did we agree on?',
      resourceId: 'resource-1',
      topK: 5,
      filter: { threadId: 'thread-1', observedAfter: new Date('2026-05-01T00:00:00.000Z') },
    });

    expect(vector.query).toHaveBeenCalledWith({
      indexName: 'memory_observations_selfembed',
      queryText: 'What deadline did we agree on?',
      topK: 5,
      filter: {
        resource_id: 'resource-1',
        thread_id: 'thread-1',
        observed_at: { $gt: '2026-05-01T00:00:00.000Z' },
      },
    });
    expect(results.map(r => [r.groupId, r.recordId, r.score])).toEqual([['group-1', 'record-1', 0.9]]);
  });

  it('creates the index before the first query', async () => {
    const vector = makeSelfEmbeddingVector();
    const memory = makeMemory(vector);

    await memory.searchMessages({ query: 'deadline', resourceId: 'resource-1' });

    expect(vector.createIndex).toHaveBeenCalledWith({ indexName: 'memory_observations_selfembed' });
  });
});

describe('observational memory retrieval with a client-side embedder', () => {
  it('keeps indexing under the dimension-suffixed index name', async () => {
    const vector = makeSelfEmbeddingVector();
    (vector as any).isSelfEmbedding = false;
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder: {
        specificationVersion: 'v1',
        provider: 'test',
        modelId: 'test-model',
        doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 }, warnings: [] }),
      } as any,
      options: { observationalMemory: { retrieval: { vector: true } } },
    });

    await memory.indexObservation(observation);

    expect(vector.createIndex).toHaveBeenCalledWith({ indexName: 'memory_observations_2', dimension: 2 });
    const params = vi.mocked(vector.upsert).mock.calls[0]![0] as any;
    expect(params.vectors).toEqual([[0.1, 0.2]]);
    expect(params.documents).toBeUndefined();
  });
});
