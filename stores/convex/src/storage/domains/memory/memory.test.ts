import type { MastraDBMessage } from '@mastra/core/memory';
import { TABLE_MESSAGES, TABLE_RESOURCES, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { ConvexAdminClient } from '../../client';
import type { StorageRequest } from '../../types';
import { MemoryConvex } from './index';

function createMemoryDomain(handler: (request: StorageRequest) => unknown | Promise<unknown>) {
  const calls: StorageRequest[] = [];
  const client = {
    callStorage: vi.fn(async (request: StorageRequest) => {
      calls.push(request);
      return handler(request);
    }),
  } as unknown as ConvexAdminClient;

  return {
    calls,
    memory: new MemoryConvex({ client }),
  };
}

function createMessage(id: string, threadId: string): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId: 'resource-1',
    role: 'user',
    createdAt: new Date('2026-05-29T00:00:00.000Z'),
    content: {
      format: 2,
      parts: [{ type: 'text', text: `message ${id}` }],
      content: `message ${id}`,
    },
  };
}

describe('MemoryConvex atomic memory writes', () => {
  it('delegates thread metadata merges to one storage mutation', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      expect(request.op).toBe('updateThread');
      if (request.op !== 'updateThread') return null;
      return {
        id: request.id,
        resourceId: 'resource-1',
        title: request.title,
        metadata: { keep: true, ...request.metadata },
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: request.updatedAt,
      };
    });

    const updated = await memory.updateThread({
      id: 'thread-1',
      title: 'new title',
      metadata: { added: true },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'updateThread',
      tableName: TABLE_THREADS,
      id: 'thread-1',
      title: 'new title',
      metadata: { added: true },
    });
    expect(updated).toMatchObject({
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'new title',
      metadata: { keep: true, added: true },
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
    });
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('parses malformed thread metadata strings without failing the update result', async () => {
    const { memory } = createMemoryDomain(request => {
      expect(request.op).toBe('updateThread');
      if (request.op !== 'updateThread') return null;
      return {
        id: request.id,
        resourceId: 'resource-1',
        title: request.title,
        metadata: '{not-json',
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: request.updatedAt,
      };
    });

    await expect(
      memory.updateThread({
        id: 'thread-1',
        title: 'new title',
        metadata: { added: true },
      }),
    ).resolves.toMatchObject({
      id: 'thread-1',
      metadata: '{not-json',
    });
  });

  it('parses malformed thread metadata strings when listing threads', async () => {
    const { memory } = createMemoryDomain(request => {
      expect(request.op).toBe('queryTable');
      if (request.op !== 'queryTable') return [];
      return [
        {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'thread',
          metadata: '{not-json',
          createdAt: '2026-05-29T00:00:00.000Z',
          updatedAt: '2026-05-29T00:01:00.000Z',
        },
      ];
    });

    await expect(memory.listThreads({})).resolves.toMatchObject({
      threads: [
        {
          id: 'thread-1',
          metadata: '{not-json',
          createdAt: new Date('2026-05-29T00:00:00.000Z'),
          updatedAt: new Date('2026-05-29T00:01:00.000Z'),
        },
      ],
    });
  });

  it('rejects unsafe thread metadata filter keys before querying storage', async () => {
    const { calls, memory } = createMemoryDomain(() => {
      throw new Error('storage should not be queried for invalid metadata filters');
    });

    await expect(memory.listThreads({ filter: { metadata: { constructor: 'polluted' } } })).rejects.toMatchObject({
      id: 'MASTRA_STORAGE_CONVEX_LIST_THREADS_INVALID_METADATA_KEY',
      category: 'USER',
    });

    expect(calls).toHaveLength(0);
  });

  it('does not match malformed stored metadata strings against metadata filters', async () => {
    const { memory } = createMemoryDomain(request => {
      expect(request.op).toBe('queryTable');
      if (request.op !== 'queryTable') return [];
      return [
        {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'thread',
          metadata: '{not-json',
          createdAt: '2026-05-29T00:00:00.000Z',
          updatedAt: '2026-05-29T00:01:00.000Z',
        },
      ];
    });

    await expect(memory.listThreads({ filter: { metadata: { topic: 'support' } } })).resolves.toMatchObject({
      threads: [],
      total: 0,
    });
  });

  it('bumps saved-message threads with timestamp-only patches', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      if (request.op === 'batchInsert') return undefined;
      if (request.op === 'patch') return true;
      throw new Error(`Unexpected storage op ${request.op}`);
    });

    await memory.saveMessages({
      messages: [createMessage('message-1', 'thread-1'), createMessage('message-2', 'thread-1')],
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      op: 'batchInsert',
      tableName: TABLE_MESSAGES,
      records: expect.arrayContaining([
        expect.objectContaining({ id: 'message-1', thread_id: 'thread-1' }),
        expect.objectContaining({ id: 'message-2', thread_id: 'thread-1' }),
      ]),
    });
    expect(calls[1]).toMatchObject({
      op: 'patch',
      tableName: TABLE_THREADS,
      id: 'thread-1',
      record: { updatedAt: expect.any(String) },
    });
  });

  it('loads messages by id through indexed point lookups', async () => {
    const storedMessage = {
      id: 'message-1',
      thread_id: 'thread-1',
      resourceId: 'resource-1',
      role: 'user',
      type: 'v2',
      content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'hello' }], content: 'hello' }),
      createdAt: '2026-05-29T00:00:00.000Z',
    };
    const { calls, memory } = createMemoryDomain(request => {
      if (request.op === 'loadMany') return [storedMessage];
      throw new Error(`Unexpected storage op ${request.op}`);
    });

    await expect(memory.listMessagesById({ messageIds: ['message-1'] })).resolves.toMatchObject({
      messages: [expect.objectContaining({ id: 'message-1', threadId: 'thread-1' })],
    });

    expect(calls).toEqual([
      {
        op: 'loadMany',
        tableName: TABLE_MESSAGES,
        ids: ['message-1'],
      },
    ]);
  });

  it('bumps updated-message threads with timestamp-only patches', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      if (request.op === 'loadMany') {
        return [
          {
            id: 'message-1',
            thread_id: 'old-thread',
            resourceId: 'resource-1',
            role: 'user',
            type: 'v2',
            content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'old' }], content: 'old' }),
            createdAt: '2026-05-29T00:00:00.000Z',
          },
        ];
      }
      if (request.op === 'insert') return undefined;
      if (request.op === 'patch') return true;
      throw new Error(`Unexpected storage op ${request.op}`);
    });

    await memory.updateMessages({
      messages: [
        {
          id: 'message-1',
          threadId: 'new-thread',
          content: { format: 2, parts: [{ type: 'text', text: 'new' }], content: 'new' },
        },
      ],
    });

    expect(calls.filter(call => call.op === 'load')).toEqual([]);
    expect(calls.filter(call => call.op === 'queryTable')).toEqual([]);
    expect(calls[0]).toMatchObject({
      op: 'loadMany',
      tableName: TABLE_MESSAGES,
      ids: ['message-1'],
    });
    expect(calls.filter(call => call.op === 'patch')).toEqual([
      {
        op: 'patch',
        tableName: TABLE_THREADS,
        id: 'old-thread',
        record: { updatedAt: expect.any(String) },
      },
      {
        op: 'patch',
        tableName: TABLE_THREADS,
        id: 'new-thread',
        record: { updatedAt: expect.any(String) },
      },
    ]);
  });

  it('delegates resource upserts and metadata merges to one storage mutation', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      expect(request.op).toBe('updateResource');
      if (request.op !== 'updateResource') return null;
      return {
        id: request.resourceId,
        workingMemory: request.workingMemory,
        metadata: { keep: true, ...request.metadata },
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    });

    const updated = await memory.updateResource({
      resourceId: 'resource-1',
      workingMemory: 'new memory',
      metadata: { added: true },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'updateResource',
      tableName: TABLE_RESOURCES,
      resourceId: 'resource-1',
      workingMemory: 'new memory',
      metadata: { added: true },
    });
    expect(updated).toMatchObject({
      id: 'resource-1',
      workingMemory: 'new memory',
      metadata: { keep: true, added: true },
    });
    expect(updated.createdAt).toBeInstanceOf(Date);
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('normalizes missing resource metadata to an empty object after updates', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      expect(request.op).toBe('updateResource');
      if (request.op !== 'updateResource') return null;
      return {
        id: request.resourceId,
        workingMemory: 'existing memory',
        metadata: null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    });

    const updated = await memory.updateResource({
      resourceId: 'resource-1',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'updateResource',
      resourceId: 'resource-1',
    });
    expect(calls[0]).not.toHaveProperty('metadata');
    expect(updated).toMatchObject({
      id: 'resource-1',
      workingMemory: 'existing memory',
      metadata: {},
    });
  });

  it('parses resources created by the updateResource storage mutation', async () => {
    const { calls, memory } = createMemoryDomain(request => {
      expect(request.op).toBe('updateResource');
      if (request.op !== 'updateResource') return null;
      return {
        id: request.resourceId,
        metadata: request.metadata,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    });

    const created = await memory.updateResource({
      resourceId: 'resource-1',
      metadata: { created: true },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'updateResource',
      resourceId: 'resource-1',
      metadata: { created: true },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(created).toMatchObject({
      id: 'resource-1',
      metadata: { created: true },
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });
});
