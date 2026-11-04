import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AWAIT_BUFFER_STATUS_ROUTE, GET_MEMORY_STATUS_ROUTE, GET_OBSERVATIONAL_MEMORY_ROUTE } from './memory';
import { createTestServerContext } from './test-utils';

// Kept in its own file: getGatewayClient() caches the client for the module's lifetime.
describe('observational memory for gateway agents with a v2 key', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ['GET_OBSERVATIONAL_MEMORY_ROUTE', GET_OBSERVATIONAL_MEMORY_ROUTE],
    ['AWAIT_BUFFER_STATUS_ROUTE', AWAIT_BUFFER_STATUS_ROUTE],
  ] as const)('%s uses the agent local memory instead of the gateway', async (_name, route) => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-test');
    const agent = new Agent({
      id: 'gateway-agent',
      name: 'gateway-agent',
      instructions: 'test-instructions',
      model: 'mastra/openai/gpt-5-mini' as any,
      memory: new MockMemory(),
    });
    const mastra = new Mastra({ logger: false, agents: { 'gateway-agent': agent } });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      (route.handler as any)({
        ...createTestServerContext({ mastra }),
        agentId: 'gateway-agent',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('Observational Memory is not enabled for this agent');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  async function setupLocalOM() {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-test');
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'gateway-agent',
      name: 'gateway-agent',
      instructions: 'test-instructions',
      model: 'mastra/openai/gpt-5-mini' as any,
      memory,
    });
    const waitForBuffering = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(agent, 'resolveProcessorById').mockResolvedValue({
      config: { scope: 'thread' },
      waitForBuffering,
    } as any);
    const mastra = new Mastra({ logger: false, agents: { 'gateway-agent': agent } });
    await memory.saveThread({
      thread: { id: 'thread-1', resourceId: 'resource-1', title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const store = await memory.storage.getStore('memory');
    const record = await store!.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });
    return { mastra, store: store!, record, waitForBuffering, fetchMock: vi.spyOn(globalThis, 'fetch') };
  }

  it.each([
    ['GET_OBSERVATIONAL_MEMORY_ROUTE', GET_OBSERVATIONAL_MEMORY_ROUTE],
    ['AWAIT_BUFFER_STATUS_ROUTE', AWAIT_BUFFER_STATUS_ROUTE],
  ] as const)('%s returns the locally stored record', async (_name, route) => {
    const { mastra, record, fetchMock } = await setupLocalOM();

    const result = await (route.handler as any)({
      ...createTestServerContext({ mastra }),
      agentId: 'gateway-agent',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    expect(result.record?.id).toBe(record.id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['GET_OBSERVATIONAL_MEMORY_ROUTE', GET_OBSERVATIONAL_MEMORY_ROUTE],
    ['AWAIT_BUFFER_STATUS_ROUTE', AWAIT_BUFFER_STATUS_ROUTE],
  ] as const)('%s rejects a thread owned by another resource', async (_name, route) => {
    const { mastra, waitForBuffering } = await setupLocalOM();

    await expect(
      (route.handler as any)({
        ...createTestServerContext({ mastra }),
        agentId: 'gateway-agent',
        resourceId: 'resource-2',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('Access denied');
    expect(waitForBuffering).not.toHaveBeenCalled();
  });

  it.each([
    ['GET_OBSERVATIONAL_MEMORY_ROUTE', GET_OBSERVATIONAL_MEMORY_ROUTE],
    ['AWAIT_BUFFER_STATUS_ROUTE', AWAIT_BUFFER_STATUS_ROUTE],
  ] as const)('%s reads with the trusted resource ID, not the caller-supplied one', async (_name, route) => {
    const { mastra, store, record, waitForBuffering } = await setupLocalOM();
    const getRecord = vi.spyOn(store, 'getObservationalMemory');
    const context = createTestServerContext({ mastra });
    context.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-1');

    const result = await (route.handler as any)({
      ...context,
      agentId: 'gateway-agent',
      resourceId: 'resource-2',
      threadId: 'thread-1',
    });

    expect(result.record?.id).toBe(record.id);
    expect(getRecord).toHaveBeenCalledWith('thread-1', 'resource-1');
    if (route === AWAIT_BUFFER_STATUS_ROUTE) {
      expect(waitForBuffering).toHaveBeenCalledWith('thread-1', 'resource-1');
    }
  });

  it.each([
    ['GET_OBSERVATIONAL_MEMORY_ROUTE', GET_OBSERVATIONAL_MEMORY_ROUTE],
    ['AWAIT_BUFFER_STATUS_ROUTE', AWAIT_BUFFER_STATUS_ROUTE],
  ] as const)('%s does not return a thread-scoped record whose thread is gone', async (_name, route) => {
    const { mastra, store, waitForBuffering } = await setupLocalOM();
    await store.initializeObservationalMemory({
      threadId: 'deleted-thread',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    const result = await (route.handler as any)({
      ...createTestServerContext({ mastra }),
      agentId: 'gateway-agent',
      resourceId: 'resource-2',
      threadId: 'deleted-thread',
    });

    expect(result.record).toBeNull();
    expect(waitForBuffering).not.toHaveBeenCalled();
  });

  describe('GET_MEMORY_STATUS_ROUTE', () => {
    const getStatus = (mastra: Mastra, resourceId: string, threadId: string) =>
      (GET_MEMORY_STATUS_ROUTE.handler as any)({
        ...createTestServerContext({ mastra }),
        agentId: 'gateway-agent',
        resourceId,
        threadId,
      });

    it('reports the local record for the thread owner', async () => {
      const { mastra, fetchMock } = await setupLocalOM();

      const result = await getStatus(mastra, 'resource-1', 'thread-1');

      expect(result.memoryType).toBe('local');
      expect(result.observationalMemory).toMatchObject({ enabled: true, hasRecord: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a thread owned by another resource', async () => {
      const { mastra } = await setupLocalOM();

      await expect(getStatus(mastra, 'resource-2', 'thread-1')).rejects.toThrow('Access denied');
    });

    it('does not report a thread-scoped record whose thread is gone', async () => {
      const { mastra, store } = await setupLocalOM();
      await store.initializeObservationalMemory({
        threadId: 'deleted-thread',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      });

      const result = await getStatus(mastra, 'resource-2', 'deleted-thread');

      expect(result.observationalMemory).toEqual({ enabled: true, hasRecord: false });
    });
  });
});
