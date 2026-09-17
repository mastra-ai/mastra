import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createController(storage: InMemoryStore, initialState: Record<string, unknown> = {}, stateSchema?: unknown) {
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
    ...(stateSchema ? { stateSchema: stateSchema as any } : {}),
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

  it('deletes a cleared preference so it stays cleared after restart', async () => {
    const stateSchema = z.object({
      thinkingLevel: z.preprocess(
        value => (value === null ? undefined : value),
        z.enum(['off', 'low', 'medium', 'high']).optional(),
      ),
    });
    const controller = createController(storage, {}, stateSchema);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    await session.state.set({ thinkingLevel: 'high' });
    await session.state.set({ thinkingLevel: null });

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(Object.hasOwn(savedThread?.metadata ?? {}, 'thinkingLevel')).toBe(false);

    const restarted = createController(storage, {}, stateSchema);
    await restarted.init();
    const restartedSession = await restarted.createSession({ id: 'restarted-session', ownerId: 'test-owner' });
    await restartedSession.thread.switch({ threadId: thread.id });

    expect(restartedSession.state.get().thinkingLevel).toBeUndefined();
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

  it('restores each valid preference even when the other stored value is invalid', async () => {
    const stateSchema = z.object({
      thinkingLevel: z.enum(['off', 'low', 'medium', 'high']).optional(),
      notifications: z.enum(['off', 'bell', 'system', 'both']).optional(),
    });
    const controller = createController(storage, {}, stateSchema);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    // A stale deployment left an invalid thinkingLevel behind; notifications is fine.
    const memory = await storage.getStore('memory');
    await memory!.updateThread({
      id: thread.id,
      title: 'thread',
      metadata: { thinkingLevel: 'turbo', notifications: 'bell' },
    });

    const restarted = createController(storage, {}, stateSchema);
    await restarted.init();
    const restartedSession = await restarted.createSession({ id: 'restarted-session', ownerId: 'test-owner' });
    await restartedSession.thread.switch({ threadId: thread.id });

    // The invalid value is dropped; the valid one still restores.
    expect((restartedSession.state.get() as any).thinkingLevel).toBeUndefined();
    expect((restartedSession.state.get() as any).notifications).toBe('bell');
  });

  it('persists a queued preference update to the thread that was active when it was requested', async () => {
    const controller = createController(storage);
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const threadA = await session.thread.create();

    // Jam the update queue so the preference write is still pending when the
    // session switches threads.
    let releaseBlock!: () => void;
    let markBlockStarted!: () => void;
    const block = new Promise<void>(resolve => {
      releaseBlock = resolve;
    });
    const blockStarted = new Promise<void>(resolve => {
      markBlockStarted = resolve;
    });
    const blocker = session.state.update(async () => {
      markBlockStarted();
      await block;
      return { updates: {}, result: undefined };
    });
    await blockStarted;
    const pending = session.state.set({ thinkingLevel: 'high' } as any);

    const threadB = await session.thread.create();
    releaseBlock();
    await blocker;
    await pending;

    const memory = await storage.getStore('memory');
    const savedA = await memory?.getThreadById({ threadId: threadA.id });
    const savedB = await memory?.getThreadById({ threadId: threadB.id });
    // The write lands on thread A (active at request time), never on thread B.
    expect(savedA?.metadata?.thinkingLevel).toBe('high');
    expect(savedB?.metadata?.thinkingLevel).toBeUndefined();
  });
});
