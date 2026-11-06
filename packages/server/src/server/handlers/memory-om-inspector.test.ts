import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { ObservationalMemoryInspector } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AWAIT_BUFFER_STATUS_ROUTE,
  GET_MEMORY_CONFIG_ROUTE,
  GET_MEMORY_STATUS_ROUTE,
  GET_OBSERVATIONAL_MEMORY_ROUTE,
} from './memory';
import { createTestServerContext } from './test-utils';

const record = (generationCount: number, activeObservations: string): ObservationalMemoryRecord => ({
  id: `om_${generationCount}`,
  scope: 'thread',
  threadId: 't1',
  resourceId: 'user-1',
  createdAt: new Date('2026-11-05T07:00:00Z'),
  updatedAt: new Date('2026-11-05T07:39:00Z'),
  lastObservedAt: new Date('2026-11-05T07:39:23Z'),
  originType: generationCount ? 'reflection' : 'initial',
  generationCount,
  activeObservations,
  totalTokensObserved: 9000,
  observationTokenCount: 2004,
  pendingMessageTokens: 120,
  isObserving: false,
  isReflecting: false,
  isBufferingObservation: false,
  isBufferingReflection: false,
  config: {},
});

/** Memory whose OM runs elsewhere and reports itself through the inspector contract. */
class RemoteOMMemory extends MockMemory {
  constructor(
    readonly inspector: ObservationalMemoryInspector,
    storage: InMemoryStore,
  ) {
    super({ storage });
  }
  override getObservationalMemoryInspector() {
    return this.inspector;
  }
}

describe('Memory handlers with a memory-provided OM inspector', () => {
  let storage: InMemoryStore;
  let inspector: ObservationalMemoryInspector;
  let mastra: Mastra;
  let memory: RemoteOMMemory;

  beforeEach(async () => {
    storage = new InMemoryStore();
    inspector = {
      kind: 'platform',
      getConfig: vi.fn(async () => ({ scope: 'thread' as const, messageTokens: 500, observationTokens: 1000 })),
      getDisplayConfig: () => ({ lastMessages: false, semanticRecall: false }),
      getRecord: vi.fn(async ({ historyLimit }) => ({
        record: record(1, '- reflected'),
        history: historyLimit ? [record(1, '- reflected'), record(0, '- first')] : undefined,
      })),
      waitForBuffering: vi.fn(async () => {}),
    };
    memory = new RemoteOMMemory(inspector, storage);
    const agent = new Agent({ id: 'assistant', name: 'assistant', instructions: 'x', model: {} as any, memory });
    mastra = new Mastra({ logger: false, storage, agents: { assistant: agent } });
    await memory.createThread({ threadId: 't1', resourceId: 'user-1' });
  });

  it('reports OM as enabled with the inspector thresholds and display config', async () => {
    const result = await GET_MEMORY_CONFIG_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'assistant',
    });
    expect(result).toMatchObject({
      memoryType: 'platform',
      config: {
        lastMessages: false,
        semanticRecall: false,
        observationalMemory: { enabled: true, scope: 'thread', messageTokens: 500, observationTokens: 1000 },
      },
    });
  });

  it('reports the thread record in status', async () => {
    const result = await GET_MEMORY_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'assistant',
      resourceId: 'user-1',
      threadId: 't1',
    });
    expect(result).toEqual({
      result: true,
      memoryType: 'platform',
      observationalMemory: {
        enabled: true,
        hasRecord: true,
        originType: 'reflection',
        lastObservedAt: new Date('2026-11-05T07:39:23Z'),
        tokenCount: 9000,
        observationTokenCount: 2004,
        isObserving: false,
        isReflecting: false,
      },
    });
  });

  it('reports no record for a thread that does not exist yet', async () => {
    const result = await GET_MEMORY_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'assistant',
      resourceId: 'user-1',
      threadId: 'new-thread',
    });
    expect(result).toMatchObject({ observationalMemory: { enabled: true, hasRecord: false } });
    expect(inspector.getRecord).not.toHaveBeenCalled();
  });

  it('returns the record and its generations', async () => {
    const result = await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'assistant',
      resourceId: 'user-1',
      threadId: 't1',
    });
    expect(inspector.getRecord).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 't1', resourceId: 'user-1', historyLimit: 5 }),
    );
    expect(result.record?.generationCount).toBe(1);
    expect(result.history?.map(h => h.activeObservations)).toEqual(['- reflected', '- first']);
  });

  it("refuses a caller reading another resource's thread", async () => {
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'someone-else');
    await expect(
      GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        requestContext,
        agentId: 'assistant',
        resourceId: 'someone-else',
        threadId: 't1',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(inspector.getRecord).not.toHaveBeenCalled();
  });

  it('waits on the inspector, then returns the record', async () => {
    const result = await AWAIT_BUFFER_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'assistant',
      resourceId: 'user-1',
      threadId: 't1',
    });
    expect(inspector.waitForBuffering).toHaveBeenCalledWith({ threadId: 't1', resourceId: 'user-1' });
    expect(result.record?.id).toBe('om_1');
  });

  it('reports OM off when the inspector says so', async () => {
    vi.mocked(inspector.getConfig).mockResolvedValue(null);
    await expect(
      GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'assistant',
        resourceId: 'user-1',
        threadId: 't1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
