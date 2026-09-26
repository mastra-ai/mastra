import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { MASTRA_MESSAGE_AUTHOR_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

const now = new Date('2026-01-01T00:00:00.000Z');

function callerContext(id: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_MESSAGE_AUTHOR_KEY, { id });
  return requestContext;
}

async function setup() {
  const controllerStorage = new InMemoryStore();
  const stores: Record<string, InMemoryStore> = { alice: new InMemoryStore(), bob: new InMemoryStore() };
  const recalls: string[] = [];
  const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
    const caller = (requestContext.get(MASTRA_MESSAGE_AUTHOR_KEY) as { id: string } | undefined)?.id ?? 'none';
    const memory = new MockMemory({ storage: stores[caller] ?? controllerStorage });
    const recall = memory.recall.bind(memory);
    return Object.assign(memory, {
      recall: (args: Parameters<typeof recall>[0]) => {
        if (args.threadId === 't') recalls.push(caller);
        return recall(args);
      },
    });
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    resourceId: 'shared-resource',
    storage: controllerStorage,
    memory: memoryFactory as any,
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent: new Agent({
          id: 'a',
          name: 'a',
          instructions: 'x',
          model: { provider: 'openai', name: 'gpt-4o' } as any,
        }),
      },
    ],
  });
  await controller.init();
  for (const store of [controllerStorage, stores.alice!, stores.bob!]) {
    const memoryStore = await store.getStore('memory');
    await memoryStore!.saveThread({
      thread: { id: 't', resourceId: 'shared-resource', createdAt: now, updatedAt: now, metadata: {} },
    });
  }
  const session = await controller.createSession({ id: 's', ownerId: 'o' });
  recalls.length = 0;
  return { session, recalls };
}

describe('AgentController subscription caller binding', () => {
  it("rebinds an idle subscription when a different caller uses the thread, so B never reads through A's memory", async () => {
    const { session, recalls } = await setup();

    await session.thread.switch({ threadId: 't', requestContext: callerContext('alice') });
    expect(recalls).toEqual(['alice']);

    await session.thread.ensureCurrentSubscription(callerContext('bob'));
    expect(recalls).toEqual(['alice', 'bob']);
  });

  it('keeps the existing subscription for the same caller or when no caller is identified', async () => {
    const { session, recalls } = await setup();

    await session.thread.switch({ threadId: 't', requestContext: callerContext('alice') });
    await session.thread.ensureCurrentSubscription(callerContext('alice'));
    await session.thread.ensureCurrentSubscription(new RequestContext());
    await session.thread.ensureCurrentSubscription();

    expect(recalls).toEqual(['alice']);
  });

  it('refuses a different caller while a run is in flight instead of tearing it down', async () => {
    const { session, recalls } = await setup();

    await session.thread.switch({ threadId: 't', requestContext: callerContext('alice') });
    vi.spyOn(session.run, 'isRunning').mockReturnValue(true);

    await expect(session.thread.ensureCurrentSubscription(callerContext('bob'))).rejects.toThrow(
      /running for another caller/,
    );
    expect(recalls).toEqual(['alice']);
  });
});
