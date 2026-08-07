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

describe('AgentController session preference persistence (thinkingLevel, notifications)', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('mirrors thinkingLevel and notifications into thread metadata on state updates', async () => {
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const thread = await session.thread.create();
    await session.state.set({ thinkingLevel: 'high', notifications: 'bell' } as any);

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(savedThread?.metadata?.thinkingLevel).toBe('high');
    expect(savedThread?.metadata?.notifications).toBe('bell');
  });

  it('does not mirror non-preference state keys into thread metadata', async () => {
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const thread = await session.thread.create();
    await session.state.set({ yolo: true, thinkingLevel: 'low' } as any);

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(savedThread?.metadata?.thinkingLevel).toBe('low');
    expect(savedThread?.metadata?.yolo).toBeUndefined();
  });

  it('restores preferences from thread metadata after a simulated restart', async () => {
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const thread = await session.thread.create();
    await session.state.set({ thinkingLevel: 'xhigh', notifications: 'system' } as any);

    // Simulate a host restart: a fresh controller + session over the same storage.
    const restarted = createController(storage);
    await restarted.init();
    const restartedSession = await restarted.createSession({ id: 'restarted-session', ownerId: 'test-owner' });
    await restartedSession.thread.switch({ threadId: thread.id });

    expect((restartedSession.state.get() as any).thinkingLevel).toBe('xhigh');
    expect((restartedSession.state.get() as any).notifications).toBe('system');
  });

  it('restores preferences when switching back to a thread', async () => {
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const threadA = await session.thread.create();
    await session.state.set({ thinkingLevel: 'medium', notifications: 'both' } as any);

    await session.thread.create();
    await session.state.set({ thinkingLevel: 'off', notifications: 'off' } as any);

    await session.thread.switch({ threadId: threadA.id });

    expect((session.state.get() as any).thinkingLevel).toBe('medium');
    expect((session.state.get() as any).notifications).toBe('both');
  });
});
