import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type {
  GetObservationalMemoryRecordsInput,
  ObservationalMemoryRecords,
  ObservationalMemorySettings,
} from '@mastra/core/memory';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  AWAIT_BUFFER_STATUS_ROUTE,
  GET_MEMORY_CONFIG_ROUTE,
  GET_MEMORY_STATUS_ROUTE,
  GET_OBSERVATIONAL_MEMORY_ROUTE,
} from './memory';
import { createTestServerContext } from './test-utils';

function omRecord(threadId: string, resourceId: string, generationCount: number): ObservationalMemoryRecord {
  return {
    id: `om-${threadId}-${generationCount}`,
    scope: 'thread',
    threadId,
    resourceId,
    originType: generationCount === 0 ? 'initial' : 'reflection',
    generationCount,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-02T00:00:00.000Z'),
    lastObservedAt: new Date('2026-11-02T00:00:00.000Z'),
    activeObservations: `generation ${generationCount}`,
    observationTokenCount: 120,
    totalTokensObserved: 4_000,
    pendingMessageTokens: 0,
    isObserving: false,
    isReflecting: true,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: {},
  };
}

/** A memory adapter that runs Observational Memory itself, the way hosted memory does. */
class AdapterOMMemory extends MockMemory {
  /** Generations per thread, newest first. */
  readonly generations = new Map<string, ObservationalMemoryRecord[]>();
  readonly reads: GetObservationalMemoryRecordsInput[] = [];

  async getObservationalMemoryConfig(): Promise<ObservationalMemorySettings> {
    return { enabled: true, scope: 'thread', messageTokens: 25_000, observationTokens: 50_000 };
  }

  async getObservationalMemoryRecords(args: GetObservationalMemoryRecordsInput): Promise<ObservationalMemoryRecords> {
    this.reads.push(args);
    const [record, ...history] = this.generations.get(args.threadId!) ?? [];
    return { record: record ?? null, history: history.slice(0, args.historyLimit ?? 0) };
  }
}

function contextFor(mastra: Mastra, resourceId?: string) {
  const requestContext = new RequestContext();
  if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return { ...createTestServerContext({ mastra }), requestContext };
}

describe('Observational Memory routes with a memory adapter that runs OM', () => {
  let storage: InMemoryStore;
  let memory: AdapterOMMemory;
  let mastra: Mastra;

  beforeEach(async () => {
    storage = new InMemoryStore();
    memory = new AdapterOMMemory({ storage });
    const agent = new Agent({ id: 'hosted', name: 'hosted', instructions: 'test', model: {} as any, memory });
    mastra = new Mastra({ logger: false, storage, agents: { hosted: agent } });
    await memory.createThread({ threadId: 'thread-a', resourceId: 'user-a' });
    await memory.createThread({ threadId: 'thread-b', resourceId: 'user-b' });
  });

  it('reports the adapter settings from the config route', async () => {
    const result = await GET_MEMORY_CONFIG_ROUTE.handler({ ...createTestServerContext({ mastra }), agentId: 'hosted' });
    expect(result.config?.observationalMemory).toEqual({
      enabled: true,
      scope: 'thread',
      messageTokens: 25_000,
      observationTokens: 50_000,
    });
  });

  it('reports status from the adapter record', async () => {
    memory.generations.set('thread-a', [omRecord('thread-a', 'user-a', 1)]);
    const result = await GET_MEMORY_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
      threadId: 'thread-a',
    });
    expect(result).toEqual({
      result: true,
      memoryType: 'local',
      observationalMemory: {
        enabled: true,
        hasRecord: true,
        originType: 'reflection',
        lastObservedAt: new Date('2026-11-02T00:00:00.000Z'),
        tokenCount: 4_000,
        observationTokenCount: 120,
        isObserving: false,
        isReflecting: true,
      },
    });
  });

  it('reports enabled without a record when the adapter has none, and enabled only without a thread', async () => {
    const empty = await GET_MEMORY_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
      threadId: 'thread-a',
    });
    expect(empty.observationalMemory).toEqual({ enabled: true, hasRecord: false });

    const noThread = await GET_MEMORY_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
    });
    expect(noThread.observationalMemory).toEqual({ enabled: true });
    expect(memory.reads).toHaveLength(1);
  });

  it('returns the adapter record and history from the observational-memory route', async () => {
    memory.generations.set('thread-a', [
      omRecord('thread-a', 'user-a', 2),
      omRecord('thread-a', 'user-a', 1),
      omRecord('thread-a', 'user-a', 0),
    ]);
    const result = await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
      threadId: 'thread-a',
    });
    expect(result.record?.id).toBe('om-thread-a-2');
    expect(result.history?.map(r => r.id)).toEqual(['om-thread-a-1', 'om-thread-a-0']);
    expect(memory.reads.at(-1)).toMatchObject({ threadId: 'thread-a', resourceId: 'user-a', historyLimit: 5 });
  });

  it('returns an empty record without reading local storage when the adapter has none', async () => {
    // A record in the agent's local storage must not leak into the adapter's empty result
    const memoryStore = await storage.getStore('memory');
    await memoryStore!.initializeObservationalMemory({
      threadId: 'thread-a',
      resourceId: 'user-a',
      scope: 'thread',
      config: {},
    });

    const records = await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
      threadId: 'thread-a',
    });
    expect(records).toEqual({ record: null, history: undefined });
  });

  it('does not report a readable adapter snapshot as completed buffering', async () => {
    memory.generations.set('thread-a', [omRecord('thread-a', 'user-a', 1)]);
    await expect(
      AWAIT_BUFFER_STATUS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'hosted',
        resourceId: 'user-a',
        threadId: 'thread-a',
      }),
    ).rejects.toMatchObject({ status: 501 });
  });

  it('returns empty for a thread that does not exist', async () => {
    memory.generations.set('gone', [omRecord('gone', 'user-a', 0)]);
    const result = await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'hosted',
      resourceId: 'user-a',
      threadId: 'gone',
    });
    expect(result).toEqual({ record: null, history: undefined });
    expect(memory.reads).toHaveLength(0);
  });

  describe('access boundaries', () => {
    beforeEach(() => {
      memory.generations.set('thread-b', [omRecord('thread-b', 'user-b', 1), omRecord('thread-b', 'user-b', 0)]);
    });

    const denied = new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' });

    it("rejects another resource's thread on every route without reading it", async () => {
      const args = { agentId: 'hosted', threadId: 'thread-b' };
      await expect(GET_MEMORY_STATUS_ROUTE.handler({ ...contextFor(mastra, 'user-a'), ...args })).rejects.toThrow(
        denied,
      );
      await expect(
        GET_OBSERVATIONAL_MEMORY_ROUTE.handler({ ...contextFor(mastra, 'user-a'), ...args }),
      ).rejects.toThrow(denied);
      await expect(AWAIT_BUFFER_STATUS_ROUTE.handler({ ...contextFor(mastra, 'user-a'), ...args })).rejects.toThrow(
        denied,
      );
      expect(memory.reads).toHaveLength(0);
    });

    it('serves the owning resource', async () => {
      const result = await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
        ...contextFor(mastra, 'user-b'),
        agentId: 'hosted',
        threadId: 'thread-b',
      });
      expect(result.record?.id).toBe('om-thread-b-1');
    });

    it('returns 404 for an unknown agent', async () => {
      const notFound = new HTTPException(404, { message: 'Agent not found' });
      const args = { agentId: 'missing', resourceId: 'user-b', threadId: 'thread-b' };
      await expect(
        GET_OBSERVATIONAL_MEMORY_ROUTE.handler({ ...createTestServerContext({ mastra }), ...args }),
      ).rejects.toThrow(notFound);
      await expect(
        AWAIT_BUFFER_STATUS_ROUTE.handler({ ...createTestServerContext({ mastra }), ...args }),
      ).rejects.toThrow(notFound);
      expect(memory.reads).toHaveLength(0);
    });
  });

  it('passes adapter errors through with their status', async () => {
    memory.getObservationalMemoryRecords = async () => {
      throw Object.assign(new Error('from, to, or offset filters are not supported'), { details: { status: 400 } });
    };
    await expect(
      GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'hosted',
        resourceId: 'user-a',
        threadId: 'thread-a',
        offset: 3,
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('filters are not supported') });
  });
});

describe('Observational Memory routes with local memory that does not run OM', () => {
  it('keeps reporting OM as disabled', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const agent = new Agent({ id: 'local', name: 'local', instructions: 'test', model: {} as any, memory });
    const mastra = new Mastra({ logger: false, storage, agents: { local: agent } });
    await memory.createThread({ threadId: 'thread-a', resourceId: 'user-a' });
    const args = {
      ...createTestServerContext({ mastra }),
      agentId: 'local',
      resourceId: 'user-a',
      threadId: 'thread-a',
    };

    const status = await GET_MEMORY_STATUS_ROUTE.handler(args);
    expect(status).toEqual({ result: true, memoryType: 'local', observationalMemory: undefined });

    const config = await GET_MEMORY_CONFIG_ROUTE.handler(args);
    expect(config.config?.observationalMemory).toEqual({ enabled: false });

    const notEnabled = new HTTPException(400, { message: 'Observational Memory is not enabled for this agent' });
    await expect(GET_OBSERVATIONAL_MEMORY_ROUTE.handler(args)).rejects.toThrow(notEnabled);
    await expect(AWAIT_BUFFER_STATUS_ROUTE.handler(args)).rejects.toThrow(notEnabled);
  });
});
