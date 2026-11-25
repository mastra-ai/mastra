import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { AWAIT_BUFFER_STATUS_ROUTE, GET_OBSERVATIONAL_MEMORY_ROUTE } from './memory';
import { createTestServerContext } from './test-utils';

async function setup() {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  for (let index = 0; index < 3; index += 1) {
    await memory.createThread({ threadId: `thread-${index}`, resourceId: 'resource' });
  }
  const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'x', model: {} as never, memory });
  vi.spyOn(agent, 'resolveProcessorById').mockResolvedValue({
    config: { scope: 'resource' },
    getRecord: vi.fn().mockResolvedValue(null),
    getHistory: vi.fn().mockResolvedValue([]),
    waitForBuffering: vi.fn().mockResolvedValue(undefined),
  } as any);
  const mastra = new Mastra({ logger: false, storage, agents: { agent } });
  const listThreads = vi.spyOn(memory, 'listThreads');
  return { mastra, listThreads };
}

const omArgs = {
  agentId: 'agent',
  resourceId: 'resource',
  from: undefined,
  to: undefined,
  offset: undefined,
  limit: undefined,
};

// Resource-scoped observational-memory reads without a thread must not list every thread in the
// resource unless per-user FGA has to clear each one.
describe('resource-scoped observational-memory authorization', () => {
  it('reads without listing the resource when FGA is off', async () => {
    const { mastra, listThreads } = await setup();

    await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({ ...createTestServerContext({ mastra }), ...omArgs } as any);
    await AWAIT_BUFFER_STATUS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agentId: 'agent',
      resourceId: 'resource',
    } as any);

    for (const [args] of listThreads.mock.calls) {
      expect(args?.perPage).not.toBe(false);
    }
  });

  it('still clears every thread in the resource with per-user FGA', async () => {
    const { mastra } = await setup();
    const require = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { require } } as any);
    const ctx = createTestServerContext({ mastra });
    ctx.requestContext.set('user', { id: 'user-1' });

    await GET_OBSERVATIONAL_MEMORY_ROUTE.handler({ ...ctx, ...omArgs } as any);

    const checked = require.mock.calls.map(([, input]) => input.resource.id).sort();
    expect(checked).toEqual(['thread-0', 'thread-1', 'thread-2']);
  });

  it('refuses a resource with no threads when FGA is configured', async () => {
    const { mastra } = await setup();
    vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { require: vi.fn() } } as any);

    await expect(
      GET_OBSERVATIONAL_MEMORY_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        ...omArgs,
        resourceId: 'empty-resource',
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });
});
