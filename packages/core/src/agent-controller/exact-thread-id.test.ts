import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

async function createController(storage: InMemoryStore) {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
  });
  await controller.init();
  return controller;
}

describe('AgentController exact thread id creation', () => {
  it('creates and binds the requested thread id', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(session.identity.getId()).toBe('session-1');
    expect(session.identity.getResourceId()).toBe('session-1');
    expect(session.thread.getId()).toBe('session-1');
    expect((await session.thread.getById({ threadId: 'session-1' }))?.resourceId).toBe('session-1');
  });

  it('resumes the requested thread id after restart', async () => {
    const storage = new InMemoryStore();
    const first = await createController(storage);
    const firstSession = await first.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });
    expect(firstSession.thread.getId()).toBe('session-1');

    const second = await createController(storage);
    const resumed = await second.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(resumed.thread.getId()).toBe('session-1');
    expect(await resumed.thread.list()).toHaveLength(1);
  });

  it('rejects binding an existing exact thread owned by another resource', async () => {
    const storage = new InMemoryStore();
    const first = await createController(storage);
    await first.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'resource-a',
      threadId: 'shared-thread',
    });

    const second = await createController(storage);
    await expect(
      second.createSession({
        id: 'session-2',
        ownerId: 'owner-1',
        resourceId: 'resource-b',
        threadId: 'shared-thread',
      }),
    ).rejects.toThrow('Thread not found: shared-thread');
  });

  it('deduplicates concurrent exact thread creation for the same resource', async () => {
    const controller = await createController(new InMemoryStore());
    const [a, b] = await Promise.all([
      controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1', threadId: 'session-1' }),
      controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1', threadId: 'session-1' }),
    ]);

    expect(a).toBe(b);
    expect(a.thread.getId()).toBe('session-1');
    expect(await a.thread.list()).toHaveLength(1);
  });

  it('honors the exact thread id when a thread-agnostic caller created the session first', async () => {
    const controller = await createController(new InMemoryStore());
    // Simulates an SSE subscribe / message list racing ahead of the exact-thread create.
    const first = await controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1' });
    const initialThreadId = first.thread.getId();
    expect(initialThreadId).not.toBe('session-1');

    const second = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(second).toBe(first);
    expect(second.thread.getId()).toBe('session-1');
    expect((await second.thread.getById({ threadId: 'session-1' }))?.resourceId).toBe('session-1');
  });

  it('switches a cached session back to an existing exact thread', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });
    await session.thread.create({ title: 'detour' });
    expect(session.thread.getId()).not.toBe('session-1');

    const again = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(again).toBe(session);
    expect(again.thread.getId()).toBe('session-1');
    expect(await again.thread.list()).toHaveLength(2);
  });

  it('rejects an exact thread owned by another resource on a cached session', async () => {
    const storage = new InMemoryStore();
    const controller = await createController(storage);
    await controller.createSession({
      id: 'session-a',
      ownerId: 'owner-1',
      resourceId: 'resource-a',
      threadId: 'thread-a',
    });
    const cached = await controller.createSession({ id: 'session-b', ownerId: 'owner-1', resourceId: 'resource-b' });

    await expect(
      controller.createSession({
        id: 'session-b',
        ownerId: 'owner-1',
        resourceId: 'resource-b',
        threadId: 'thread-a',
      }),
    ).rejects.toThrow('Thread not found: thread-a');
    // The cached session keeps its original binding.
    expect(cached.thread.getId()).not.toBe('thread-a');
  });

  it('keeps the current thread binding when detaching its stream subscription', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'resource-1' });
    const threadId = session.thread.requireId();

    session.thread.detachFromCurrent();

    expect(session.thread.getId()).toBe(threadId);
    expect((await session.thread.getById({ threadId }))?.id).toBe(threadId);
  });

  it('keeps default multi-thread behavior when threadId is omitted', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'resource-1' });

    expect(session.thread.getId()).toBeTruthy();
    expect(session.thread.getId()).not.toBe('session-1');
    const secondThread = await session.thread.create({ title: 'second' });
    expect(secondThread.id).not.toBe('session-1');
    expect(await session.thread.list()).toHaveLength(2);
  });
});
