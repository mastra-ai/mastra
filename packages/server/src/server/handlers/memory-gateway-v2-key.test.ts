import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AWAIT_BUFFER_STATUS_ROUTE, GET_OBSERVATIONAL_MEMORY_ROUTE } from './memory';
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
});
