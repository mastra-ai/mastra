import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector, QueryResult } from '@mastra/core/vector';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';
import { BRANCH_SEMANTIC_RECALL_MAX_QUERIES } from './semantic-recall';

const resourceId = 'semantic-branch-resource';
const baseTime = new Date('2026-03-01T00:00:00.000Z');

function message(
  id: string,
  threadId: string,
  milliseconds: number,
  metadata?: Record<string, string>,
): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: id }], ...(metadata ? { metadata } : {}) },
    createdAt: new Date(baseTime.getTime() + milliseconds),
  };
}

function hit(id: string, messageId: string, threadId: string, score: number): QueryResult {
  return { id, score, metadata: { message_id: messageId, thread_id: threadId, resource_id: resourceId } };
}

function createMemory(query: ReturnType<typeof vi.fn>, options: Record<string, unknown> = {}) {
  const vector = {
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue([]),
    query,
    listIndexes: vi.fn().mockResolvedValue([]),
    deleteVectors: vi.fn().mockResolvedValue(undefined),
    describeIndex: vi.fn().mockResolvedValue({ dimension: 3 }),
    id: 'semantic-branch-vector',
  } as unknown as MastraVector;
  const embedder = {
    doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]], usage: { tokens: 3 } }),
    modelId: 'semantic-branch-embedder',
    specificationVersion: 'v1',
    provider: 'mock',
  } as any;
  return {
    memory: new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder,
      options: {
        lastMessages: false,
        semanticRecall: { scope: 'resource', topK: 2, messageRange: 0 },
        generateTitle: false,
        ...options,
      },
    }),
    vector,
  };
}

describe('branch semantic recall', () => {
  let query: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    query = vi.fn();
  });

  it('refills past parent and sibling sentinels and expands includes only on the reachable path', async () => {
    const ranked: QueryResult[] = [];
    query.mockImplementation(async ({ topK }: { topK: number }) => ranked.slice(0, topK));
    const { memory, vector } = createMemory(query, {
      semanticRecall: {
        scope: 'resource',
        topK: 2,
        messageRange: { before: 1, after: 1 },
        filter: { project: { $eq: 'kept' } },
      },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({
      messages: [message('root-a', 'root', 1), message('root-b', 'root', 2), message('root-post', 'root', 3)],
    });
    vi.mocked(vector.upsert).mockClear();
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-b' });
    const sibling = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-a' });
    expect(vector.upsert).not.toHaveBeenCalled();
    await memory.saveMessages({
      messages: [message('child-tail', child.thread.id, 4), message('sibling-tail', sibling.thread.id, 5)],
    });
    ranked.push(
      hit('v-parent-post', 'root-post', 'root', 0.99),
      hit('v-sibling', 'sibling-tail', sibling.thread.id, 0.98),
      hit('v-root-a', 'root-a', 'root', 0.8),
      hit('v-child', 'child-tail', child.thread.id, 0.7),
    );
    vi.mocked(vector.upsert).mockClear();

    const result = await memory.recall({
      threadId: child.thread.id,
      resourceId,
      vectorSearchString: 'reachable',
    });

    expect(result.messages.map(item => item.id)).toEqual(['root-a', 'root-b', 'child-tail']);
    expect(result.messages.map(item => item.id)).not.toContain('root-post');
    expect(result.messages.map(item => item.id)).not.toContain('sibling-tail');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.map(call => call[0].topK)).toEqual([2, 4]);
    expect(query.mock.calls[0]![0].filter).toEqual({
      $and: [{ thread_id: { $in: ['root', child.thread.id] } }, { project: { $eq: 'kept' } }],
    });
    expect(vector.upsert).not.toHaveBeenCalled();
  });

  it('excludes child-tail vectors when recalling from a root with descendants', async () => {
    const { memory } = createMemory(query);
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('root-a', 'root', 1)] });
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-a' });
    await memory.saveMessages({ messages: [message('child-tail', child.thread.id, 2)] });
    query.mockResolvedValue([
      hit('v-child', 'child-tail', child.thread.id, 0.99),
      hit('v-root', 'root-a', 'root', 0.8),
    ]);

    const result = await memory.recall({ threadId: 'root', resourceId, vectorSearchString: 'root only' });

    expect(result.messages.map(item => item.id)).toEqual(['root-a']);
    expect(query.mock.calls[0]![0].filter).toEqual({ thread_id: 'root' });
  });

  it('constrains nested branches to their inherited ancestor prefix and local tail', async () => {
    const { memory } = createMemory(query, {
      semanticRecall: { scope: 'thread', topK: 2, messageRange: 0 },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('root-a', 'root', 1), message('root-b', 'root', 2)] });
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-b' });
    await memory.saveMessages({
      messages: [message('child-a', child.thread.id, 3), message('child-post', child.thread.id, 4)],
    });
    const nested = await memory.branchThread({ threadId: child.thread.id, branchPointMessageId: 'child-a' });
    await memory.saveMessages({ messages: [message('nested-tail', nested.thread.id, 5)] });
    query.mockResolvedValue([
      hit('v-child-post', 'child-post', child.thread.id, 0.99),
      hit('v-root', 'root-b', 'root', 0.9),
      hit('v-nested', 'nested-tail', nested.thread.id, 0.8),
    ]);

    const result = await memory.recall({
      threadId: nested.thread.id,
      resourceId,
      vectorSearchString: 'nested path',
    });

    expect(result.messages.map(item => item.id)).toEqual(['root-b', 'nested-tail']);
    expect(result.messages.map(item => item.id)).not.toContain('child-post');
    expect(query.mock.calls[0]![0].filter).toEqual({
      thread_id: { $in: ['root', child.thread.id, nested.thread.id] },
    });
  });

  it('preserves resource-wide semantic recall when the resource has no branches', async () => {
    const { memory } = createMemory(query);
    await memory.createThread({ threadId: 'first', resourceId });
    await memory.createThread({ threadId: 'second', resourceId });
    await memory.saveMessages({ messages: [message('first-a', 'first', 1), message('second-a', 'second', 2)] });
    query.mockResolvedValue([hit('v-first', 'first-a', 'first', 0.9), hit('v-second', 'second-a', 'second', 0.8)]);

    const result = await memory.recall({ threadId: 'new-thread', resourceId, vectorSearchString: 'all threads' });

    expect(result.messages.map(item => item.id)).toEqual(['first-a', 'second-a']);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0].filter).toEqual({ resource_id: resourceId });
  });

  it('constrains an unrelated selected thread after another thread creates a branch in the resource', async () => {
    const { memory } = createMemory(query, {
      semanticRecall: { scope: 'resource', topK: 1, messageRange: 0, threshold: 0.8 },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.createThread({ threadId: 'unrelated', resourceId });
    await memory.saveMessages({
      messages: [message('fork', 'root', 1), message('unrelated-message', 'unrelated', 2)],
    });
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
    await memory.saveMessages({ messages: [message('child-sentinel', child.thread.id, 3)] });
    query.mockResolvedValue([
      hit('v-child', 'child-sentinel', child.thread.id, 0.99),
      hit('v-unrelated', 'unrelated-message', 'unrelated', 0.9),
    ]);

    const result = await memory.recall({
      threadId: 'unrelated',
      resourceId,
      vectorSearchString: 'selected path',
    });

    expect(result.messages.map(item => item.id)).toEqual(['unrelated-message']);
    expect(query.mock.calls[0]![0].filter).toEqual({ thread_id: 'unrelated' });
  });

  it('requires an existing selected thread for resource recall once a branch exists after more than 100 threads', async () => {
    const { memory } = createMemory(query);
    for (let index = 0; index < 101; index += 1) {
      await memory.createThread({ threadId: `thread-${index}`, resourceId });
    }
    await memory.saveMessages({ messages: [message('fork', 'thread-100', 1)] });
    await memory.branchThread({ threadId: 'thread-100', branchPointMessageId: 'fork' });

    await expect(
      memory.recall({ threadId: 'missing-resource-only-thread', resourceId, vectorSearchString: 'ambiguous' }),
    ).rejects.toMatchObject({ id: 'BRANCH_INVALID_REQUEST' });
    expect(query).not.toHaveBeenCalled();
  });

  it('stops at the named cap when every expanded batch contains new unreachable vectors', async () => {
    query.mockImplementation(async ({ topK }: { topK: number }) =>
      Array.from({ length: topK }, (_, index) =>
        hit(`vector-${query.mock.calls.length}-${index}`, `missing-${query.mock.calls.length}-${index}`, 'root', 1),
      ),
    );
    const { memory } = createMemory(query, {
      semanticRecall: { scope: 'thread', topK: 1, messageRange: 0 },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('fork', 'root', 1)] });
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    const result = await memory.recall({ threadId: 'root', resourceId, vectorSearchString: 'disjoint' });

    expect(result.messages).toEqual([]);
    expect(query).toHaveBeenCalledTimes(BRANCH_SEMANTIC_RECALL_MAX_QUERIES);
  });

  it('terminates on no progress, adapter exhaustion, and empty results', async () => {
    const { memory } = createMemory(query, {
      semanticRecall: { scope: 'thread', topK: 2, messageRange: 0 },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({ messages: [message('fork', 'root', 1)] });
    await memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });

    const duplicate = hit('same-vector', 'missing', 'root', 1);
    query.mockImplementation(async ({ topK }: { topK: number }) => Array.from({ length: topK }, () => duplicate));
    expect((await memory.recall({ threadId: 'root', resourceId, vectorSearchString: 'no progress' })).messages).toEqual(
      [],
    );
    expect(query).toHaveBeenCalledTimes(2);

    query.mockReset().mockResolvedValue([hit('one-missing', 'missing', 'root', 1)]);
    expect((await memory.recall({ threadId: 'root', resourceId, vectorSearchString: 'exhausted' })).messages).toEqual(
      [],
    );
    expect(query).toHaveBeenCalledTimes(1);

    query.mockReset().mockResolvedValue([]);
    expect((await memory.recall({ threadId: 'root', resourceId, vectorSearchString: 'empty' })).messages).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps recent branch context chronological and honors lastMessages false with semantic includes', async () => {
    const { memory } = createMemory(query, {
      lastMessages: 2,
      semanticRecall: { scope: 'thread', topK: 1, messageRange: 0 },
    });
    await memory.createThread({ threadId: 'root', resourceId });
    await memory.saveMessages({
      messages: [message('root-a', 'root', 1), message('root-b', 'root', 2), message('root-post', 'root', 3)],
    });
    const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-b' });
    await memory.saveMessages({
      messages: [message('child-a', child.thread.id, 4), message('child-b', child.thread.id, 5)],
    });
    query.mockResolvedValue([hit('v-root-a', 'root-a', 'root', 0.9)]);

    const recent = await memory.recall({ threadId: child.thread.id, resourceId });
    expect(recent.messages.map(item => item.id)).toEqual(['child-a', 'child-b']);

    const semanticOnly = await memory.recall({
      threadId: child.thread.id,
      resourceId,
      vectorSearchString: 'old message',
      threadConfig: { lastMessages: false },
    });
    expect(semanticOnly.messages.map(item => item.id)).toEqual(['root-a']);
  });
});
