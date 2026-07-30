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

describe('MemoryConvex observational memory', () => {
  const OM_TABLE = 'mastra_observational_memory';

  function storedOMDoc(overrides: Record<string, any> = {}) {
    return {
      _id: 'convex-doc-1',
      _creationTime: 1234,
      id: 'om-1',
      lookupKey: 'resource:resource-1',
      scope: 'resource',
      resourceId: 'resource-1',
      threadId: null,
      activeObservations: 'some observations',
      activeObservationsPendingUpdate: null,
      originType: 'initial',
      config: JSON.stringify({ observation: { messageTokens: 1000 } }),
      generationCount: 0,
      lastObservedAt: '2026-06-02T00:00:00.000Z',
      lastReflectionAt: null,
      pendingMessageTokens: 5,
      totalTokensObserved: 100,
      observationTokenCount: 40,
      isObserving: false,
      isReflecting: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      metadata: JSON.stringify({ custom: true }),
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
      ...overrides,
    };
  }

  it('advertises observational memory support', () => {
    const { memory } = createMemoryDomain(() => null);
    expect(memory.supportsObservationalMemory).toBe(true);
  });

  it('getObservationalMemory queries the resource lookup key and parses the stored document', async () => {
    const { calls, memory } = createMemoryDomain(() => storedOMDoc());

    const record = await memory.getObservationalMemory(null, 'resource-1');

    expect(calls).toEqual([{ op: 'omGetLatest', tableName: OM_TABLE, lookupKey: 'resource:resource-1' }]);
    expect(record).toMatchObject({
      id: 'om-1',
      scope: 'resource',
      threadId: null,
      resourceId: 'resource-1',
      activeObservations: 'some observations',
      config: { observation: { messageTokens: 1000 } },
      metadata: { custom: true },
      pendingMessageTokens: 5,
      lastBufferedAtTime: null,
    });
    expect(record?.createdAt).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(record?.lastObservedAt).toEqual(new Date('2026-06-02T00:00:00.000Z'));
    // Convex-internal fields must not leak into the parsed record
    expect(record).not.toHaveProperty('_id');
    expect(record).not.toHaveProperty('lookupKey');
  });

  it('getObservationalMemory uses the thread lookup key when a threadId is provided', async () => {
    const { calls, memory } = createMemoryDomain(() => null);

    const record = await memory.getObservationalMemory('thread-9', 'resource-1');

    expect(calls[0]).toMatchObject({ op: 'omGetLatest', lookupKey: 'thread:thread-9' });
    expect(record).toBeNull();
  });

  it('getObservationalMemoryHistory forwards range options as ISO strings with a default limit', async () => {
    const { calls, memory } = createMemoryDomain(() => [storedOMDoc()]);

    const records = await memory.getObservationalMemoryHistory(null, 'resource-1', undefined, {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-03T00:00:00.000Z'),
      offset: 2,
    });

    expect(calls).toEqual([
      {
        op: 'omGetHistory',
        tableName: OM_TABLE,
        lookupKey: 'resource:resource-1',
        limit: 10,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-03T00:00:00.000Z',
        offset: 2,
      },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('initializeObservationalMemory inserts a serialized record and returns generation zero', async () => {
    const { calls, memory } = createMemoryDomain(() => undefined);

    const record = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: { observation: { messageTokens: 1000 } },
      observedTimezone: 'Europe/Berlin',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'insert',
      tableName: OM_TABLE,
      record: {
        id: record.id,
        lookupKey: 'resource:resource-1',
        scope: 'resource',
        threadId: null,
        activeObservations: '',
        originType: 'initial',
        config: JSON.stringify({ observation: { messageTokens: 1000 } }),
        generationCount: 0,
        lastObservedAt: null,
        observedTimezone: 'Europe/Berlin',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    expect(record).toMatchObject({
      scope: 'resource',
      threadId: null,
      resourceId: 'resource-1',
      generationCount: 0,
      activeObservations: '',
      lastObservedAt: undefined,
      config: { observation: { messageTokens: 1000 } },
    });
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it('setObservingFlag patches the record and throws when it does not exist', async () => {
    const { calls, memory } = createMemoryDomain(request => request.op === 'patch');

    await memory.setObservingFlag('om-1', true);
    expect(calls[0]).toMatchObject({
      op: 'patch',
      tableName: OM_TABLE,
      id: 'om-1',
      record: { isObserving: true, updatedAt: expect.any(String) },
    });

    const { memory: missingMemory } = createMemoryDomain(() => false);
    await expect(missingMemory.setObservingFlag('missing', true)).rejects.toThrow(
      'Observational memory record not found: missing',
    );
  });

  it('setBufferingObservationFlag only includes lastBufferedAtTokens when provided', async () => {
    const { calls, memory } = createMemoryDomain(() => true);

    await memory.setBufferingObservationFlag('om-1', true, 1234);
    await memory.setBufferingObservationFlag('om-1', false);

    expect(calls[0]).toMatchObject({
      op: 'patch',
      record: { isBufferingObservation: true, lastBufferedAtTokens: 1234 },
    });
    expect((calls[1] as { record: Record<string, unknown> }).record).not.toHaveProperty('lastBufferedAtTokens');
  });

  it('setPendingMessageTokens rejects invalid token counts before calling storage', async () => {
    const { calls, memory } = createMemoryDomain(() => true);

    await expect(memory.setPendingMessageTokens('om-1', -1)).rejects.toThrow('Invalid tokenCount');
    expect(calls).toHaveLength(0);

    await memory.setPendingMessageTokens('om-1', 42);
    expect(calls[0]).toMatchObject({ op: 'patch', record: { pendingMessageTokens: 42 } });
  });

  it('updateActiveObservations emits an atomic omUpdateActive request', async () => {
    const { calls, memory } = createMemoryDomain(() => undefined);

    await memory.updateActiveObservations({
      id: 'om-1',
      observations: 'new observations',
      tokenCount: 50,
      lastObservedAt: new Date('2026-06-03T00:00:00.000Z'),
      observedMessageIds: ['msg-1'],
    });

    expect(calls).toEqual([
      {
        op: 'omUpdateActive',
        tableName: OM_TABLE,
        id: 'om-1',
        observations: 'new observations',
        tokenCount: 50,
        lastObservedAt: '2026-06-03T00:00:00.000Z',
        observedMessageIds: ['msg-1'],
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('updateBufferedObservations serializes the chunk with a generated ombuf id', async () => {
    const { calls, memory } = createMemoryDomain(() => undefined);

    await memory.updateBufferedObservations({
      id: 'om-1',
      chunk: {
        cycleId: 'cycle-1',
        observations: 'buffered obs',
        tokenCount: 10,
        messageIds: ['msg-1'],
        messageTokens: 500,
        lastObservedAt: new Date('2026-06-03T01:00:00.000Z'),
      },
      lastBufferedAtTime: new Date('2026-06-03T01:00:01.000Z'),
    });

    expect(calls[0]).toMatchObject({
      op: 'omAppendBufferedChunk',
      tableName: OM_TABLE,
      id: 'om-1',
      chunk: {
        id: expect.stringMatching(/^ombuf-/),
        cycleId: 'cycle-1',
        observations: 'buffered obs',
        lastObservedAt: '2026-06-03T01:00:00.000Z',
        createdAt: expect.any(String),
      },
      lastBufferedAtTime: '2026-06-03T01:00:01.000Z',
    });
  });

  it('swapBufferedToActive serializes refreshed chunks and returns the server result untouched', async () => {
    const serverResult = {
      chunksActivated: 1,
      messageTokensActivated: 500,
      observationTokensActivated: 10,
      messagesActivated: 1,
      activatedCycleIds: ['cycle-1'],
      activatedMessageIds: ['msg-1'],
      observations: 'buffered obs',
    };
    const { calls, memory } = createMemoryDomain(() => serverResult);

    const result = await memory.swapBufferedToActive({
      id: 'om-1',
      activationRatio: 0.8,
      messageTokensThreshold: 5000,
      currentPendingTokens: 6000,
      bufferedChunks: [
        {
          id: 'ombuf-1',
          cycleId: 'cycle-1',
          observations: 'buffered obs',
          tokenCount: 10,
          messageIds: ['msg-1'],
          messageTokens: 500,
          lastObservedAt: new Date('2026-06-03T01:00:00.000Z'),
          createdAt: new Date('2026-06-03T01:00:00.000Z'),
        },
      ],
    });

    expect(calls[0]).toMatchObject({
      op: 'omSwapBuffered',
      tableName: OM_TABLE,
      id: 'om-1',
      activationRatio: 0.8,
      messageTokensThreshold: 5000,
      currentPendingTokens: 6000,
      bufferedChunks: [
        {
          id: 'ombuf-1',
          lastObservedAt: '2026-06-03T01:00:00.000Z',
          createdAt: '2026-06-03T01:00:00.000Z',
        },
      ],
      now: expect.any(String),
    });
    expect(result).toEqual(serverResult);
  });

  it('createReflectionGeneration inserts the next generation built from the current record', async () => {
    const { calls, memory } = createMemoryDomain(() => undefined);

    const currentRecord = {
      id: 'om-1',
      scope: 'resource' as const,
      threadId: null,
      resourceId: 'resource-1',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      lastObservedAt: new Date('2026-06-02T00:00:00.000Z'),
      originType: 'initial' as const,
      generationCount: 3,
      activeObservations: 'old observations',
      totalTokensObserved: 900,
      observationTokenCount: 100,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: { observation: { messageTokens: 1000 } },
      metadata: { custom: true },
      observedTimezone: 'Europe/Berlin',
    };

    const record = await memory.createReflectionGeneration({
      currentRecord,
      reflection: 'the reflection',
      tokenCount: 42,
    });

    expect(calls[0]).toMatchObject({
      op: 'insert',
      tableName: OM_TABLE,
      record: {
        id: record.id,
        lookupKey: 'resource:resource-1',
        originType: 'reflection',
        generationCount: 4,
        activeObservations: 'the reflection',
        observationTokenCount: 42,
        totalTokensObserved: 900,
        lastReflectionAt: expect.any(String),
        metadata: JSON.stringify({ custom: true }),
      },
    });
    expect(record).toMatchObject({
      originType: 'reflection',
      generationCount: 4,
      activeObservations: 'the reflection',
      observationTokenCount: 42,
      config: { observation: { messageTokens: 1000 } },
      metadata: { custom: true },
    });
    expect(record.id).not.toBe(currentRecord.id);
  });

  it('swapBufferedReflectionToActive sends the serialized current record and parses the new generation', async () => {
    const { calls, memory } = createMemoryDomain(() =>
      storedOMDoc({
        id: 'om-2',
        originType: 'reflection',
        generationCount: 1,
        activeObservations: 'the reflection',
        lastReflectionAt: '2026-06-05T00:00:00.000Z',
      }),
    );

    const record = await memory.swapBufferedReflectionToActive({
      currentRecord: {
        id: 'om-1',
        scope: 'resource',
        threadId: null,
        resourceId: 'resource-1',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T00:00:00.000Z'),
        lastObservedAt: new Date('2026-06-02T00:00:00.000Z'),
        originType: 'initial',
        generationCount: 0,
        activeObservations: 'line 1\nline 2',
        totalTokensObserved: 900,
        observationTokenCount: 100,
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: true,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: { observation: { messageTokens: 1000 } },
      },
      tokenCount: 42,
    });

    expect(calls[0]).toMatchObject({
      op: 'omSwapBufferedReflection',
      tableName: OM_TABLE,
      currentRecord: {
        id: 'om-1',
        lookupKey: 'resource:resource-1',
        config: JSON.stringify({ observation: { messageTokens: 1000 } }),
        metadata: null,
        lastObservedAt: '2026-06-02T00:00:00.000Z',
        totalTokensObserved: 900,
        generationCount: 0,
      },
      newId: expect.any(String),
      tokenCount: 42,
      now: expect.any(String),
    });
    expect(record).toMatchObject({
      id: 'om-2',
      originType: 'reflection',
      generationCount: 1,
      activeObservations: 'the reflection',
    });
  });

  it('clearObservationalMemory deletes every generation for the lookup key', async () => {
    const { calls, memory } = createMemoryDomain(request =>
      request.op === 'queryTable' ? [storedOMDoc({ id: 'om-1' }), storedOMDoc({ id: 'om-2' })] : undefined,
    );

    await memory.clearObservationalMemory(null, 'resource-1');

    expect(calls[0]).toMatchObject({
      op: 'queryTable',
      tableName: OM_TABLE,
      filters: [{ field: 'lookupKey', value: 'resource:resource-1' }],
    });
    expect(calls[1]).toMatchObject({
      op: 'deleteMany',
      tableName: OM_TABLE,
      ids: ['om-1', 'om-2'],
    });
  });

  it('updateObservationalMemoryConfig sends the config as a JSON string', async () => {
    const { calls, memory } = createMemoryDomain(() => undefined);

    await memory.updateObservationalMemoryConfig({
      id: 'om-1',
      config: { observation: { messageTokens: 2000 } },
    });

    expect(calls[0]).toMatchObject({
      op: 'omUpdateConfig',
      tableName: OM_TABLE,
      id: 'om-1',
      config: JSON.stringify({ observation: { messageTokens: 2000 } }),
      updatedAt: expect.any(String),
    });
  });
});

describe('MemoryConvex listMessagesByResourceId', () => {
  function storedMessage(id: string, threadId: string, createdAt: string, resourceId = 'resource-1') {
    return {
      id,
      thread_id: threadId,
      content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: id }], content: id }),
      role: 'user',
      type: 'v2',
      createdAt,
      resourceId,
    };
  }

  it('queries messages across threads by resourceId and sorts ascending by default', async () => {
    const rows = [
      storedMessage('msg-2', 'thread-b', '2026-06-02T00:00:00.000Z'),
      storedMessage('msg-1', 'thread-a', '2026-06-01T00:00:00.000Z'),
      storedMessage('msg-3', 'thread-a', '2026-06-03T00:00:00.000Z'),
    ];
    const { calls, memory } = createMemoryDomain(() => rows);

    const result = await memory.listMessagesByResourceId({ resourceId: 'resource-1' });

    expect(calls).toEqual([
      {
        op: 'queryTable',
        tableName: TABLE_MESSAGES,
        filters: [{ field: 'resourceId', value: 'resource-1' }],
        indexHint: undefined,
        limit: undefined,
      },
    ]);
    expect(result.messages.map(message => message.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it('applies date range filtering and pagination', async () => {
    const rows = [
      storedMessage('msg-1', 'thread-a', '2026-06-01T00:00:00.000Z'),
      storedMessage('msg-2', 'thread-a', '2026-06-02T00:00:00.000Z'),
      storedMessage('msg-3', 'thread-b', '2026-06-03T00:00:00.000Z'),
      storedMessage('msg-4', 'thread-b', '2026-06-04T00:00:00.000Z'),
    ];
    const { memory } = createMemoryDomain(() => rows);

    const result = await memory.listMessagesByResourceId({
      resourceId: 'resource-1',
      filter: { dateRange: { start: new Date('2026-06-02T00:00:00.000Z') } },
      page: 0,
      perPage: 2,
    });

    expect(result.messages.map(message => message.id)).toEqual(['msg-2', 'msg-3']);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it('rejects negative page values', async () => {
    const { memory } = createMemoryDomain(() => []);
    await expect(memory.listMessagesByResourceId({ resourceId: 'resource-1', page: -1 })).rejects.toThrow();
  });
});
