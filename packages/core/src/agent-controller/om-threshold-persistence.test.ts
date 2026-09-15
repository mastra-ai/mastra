import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createController(storage: InMemoryStore, initialState: Record<string, unknown> = {}) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    initialState: initialState as any,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('AgentController OM threshold persistence', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores observation and reflection thresholds from thread metadata when switching back to a thread', async () => {
    const controller = createController(storage, {
      observationThreshold: 30000,
      reflectionThreshold: 40000,
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const threadA = await session.thread.create();
    await session.state.set({ observationThreshold: 12000, reflectionThreshold: 21000 } as any);
    await session.thread.setSetting({ key: 'observationThreshold', value: 12000 });
    await session.thread.setSetting({ key: 'reflectionThreshold', value: 21000 });

    await session.thread.create();
    await session.state.set({ observationThreshold: 33000, reflectionThreshold: 44000 } as any);

    await session.thread.switch({ threadId: threadA.id });

    expect((session.state.get() as any).observationThreshold).toBe(12000);
    expect((session.state.get() as any).reflectionThreshold).toBe(21000);
  });

  it('persists current thresholds onto an existing thread when metadata does not define overrides', async () => {
    const controller = createController(storage, {
      observationThreshold: 15000,
      reflectionThreshold: 25000,
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const thread = await session.thread.create();
    await session.state.set({ observationThreshold: 18000, reflectionThreshold: 28000 } as any);

    await session.thread.switch({ threadId: thread.id });

    expect((session.state.get() as any).observationThreshold).toBe(18000);
    expect((session.state.get() as any).reflectionThreshold).toBe(28000);

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(savedThread?.metadata?.observationThreshold).toBe(18000);
    expect(savedThread?.metadata?.reflectionThreshold).toBe(28000);
  });
});
