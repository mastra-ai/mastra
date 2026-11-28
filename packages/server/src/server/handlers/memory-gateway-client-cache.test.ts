import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET_THREAD_BY_ID_ROUTE, GET_WORKING_MEMORY_ROUTE } from './memory';
import { createTestServerContext } from './test-utils';

// The gateway client is memoized per process, so a non-gateway request made before the
// gateway key is set must not cache a missing client for later gateway requests.
describe('gateway client cache across memory routes', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('serves gateway threads after a non-gateway working-memory read without a gateway key', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', '');
    const localAgent = new Agent({
      id: 'local-agent',
      name: 'local-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory: new MockMemory({ storage: new InMemoryStore() }),
    });
    await GET_WORKING_MEMORY_ROUTE.handler({
      ...createTestServerContext({ mastra: new Mastra({ logger: false, agents: { 'local-agent': localAgent } }) }),
      agentId: 'local-agent',
      threadId: 'local-thread',
      resourceId: 'resource-1',
    });

    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'test-gateway-key');
    vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.example.test');
    const gatewayAgent = new Agent({
      id: 'gateway-agent',
      name: 'gateway-agent',
      instructions: 'test-instructions',
      model: 'mastra/openai/gpt-5-mini' as any,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));

    try {
      const result = await GET_THREAD_BY_ID_ROUTE.handler({
        ...createTestServerContext({
          mastra: new Mastra({ logger: false, agents: { 'gateway-agent': gatewayAgent } }),
        }),
        threadId: 'unsaved-thread',
        resourceId: 'resource-1',
        agentId: 'gateway-agent',
      });

      expect(result).toMatchObject({ id: 'unsaved-thread', resourceId: 'resource-1' });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      fetchMock.mockRestore();
    }
  });
});
