import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { createMockModel } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

function createController(
  storage: InMemoryStore,
  threadLock?: { acquire: (id: string) => void; release: (id: string) => void },
) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createMockModel({ mockText: 'ok' }),
  });

  return new AgentController({
    id: 'test-controller',
    storage,
    workspace: createMockWorkspace(),
    modes: [{ id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' }],
    threadLock,
  });
}

describe('AgentController.deleteSession', () => {
  it('tears down the live session, releases its lock, preserves its thread, and notifies listeners', async () => {
    const storage = new InMemoryStore();
    const release = vi.fn();
    const controller = createController(storage, { acquire: vi.fn(), release });
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const threadId = session.thread.requireId();
    const deleted = vi.fn();
    controller.onSessionDeleted(deleted);
    const abort = vi.spyOn(session, 'abort');
    const cleanupSubscription = vi.spyOn(session.thread, 'cleanupSubscription');

    await expect(controller.deleteSession({ resourceId: 'resource-1' })).resolves.toBe(true);

    expect(abort).toHaveBeenCalledOnce();
    expect(cleanupSubscription).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(threadId);
    expect(deleted).toHaveBeenCalledWith(session);
    await expect(controller.getSessionByResource('resource-1')).resolves.toBeUndefined();
    expect(await storage.stores.memory?.getThreadById({ threadId, resourceId: 'resource-1' })).not.toBeNull();
  });

  it('evicts the deleted session so the resource can be materialized again', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const first = await controller.createSession({ resourceId: 'resource-1' });
    const threadId = first.thread.requireId();

    await controller.deleteSession({ resourceId: 'resource-1' });
    const rematerialized = await controller.createSession({ resourceId: 'resource-1' });

    expect(rematerialized).not.toBe(first);
    expect(rematerialized.thread.requireId()).toBe(threadId);
  });

  it('is a no-op for absent sessions and isolates scopes', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const scoped = await controller.createSession({ resourceId: 'resource-1', scope: 'work' });
    const unscoped = await controller.createSession({ resourceId: 'resource-1' });

    await expect(controller.deleteSession({ resourceId: 'missing' })).resolves.toBe(false);
    await expect(controller.deleteSession({ resourceId: 'resource-1', scope: 'work' })).resolves.toBe(true);

    await expect(controller.getSessionByResource('resource-1', 'work')).resolves.toBeUndefined();
    await expect(controller.getSessionByResource('resource-1')).resolves.toBe(unscoped);
    expect(scoped.thread.getId()).toBeNull();
  });

  it('notifies exactly once when deletion is requested concurrently', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const session = await controller.createSession({ resourceId: 'resource-1' });
    const deleted = vi.fn();
    controller.onSessionDeleted(deleted);

    const results = await Promise.all([
      controller.deleteSession({ resourceId: 'resource-1' }),
      controller.deleteSession({ resourceId: 'resource-1' }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(deleted).toHaveBeenCalledWith(session);
  });

  it('stops notifications after unsubscribe and isolates listener failures', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const received = vi.fn();
    controller.onSessionDeleted(() => {
      throw new Error('sync failure');
    });
    controller.onSessionDeleted(async () => {
      throw new Error('async failure');
    });
    const unsubscribe = controller.onSessionDeleted(received);

    await controller.createSession({ resourceId: 'resource-1' });
    await controller.deleteSession({ resourceId: 'resource-1' });
    await Promise.resolve();
    unsubscribe();
    await controller.createSession({ resourceId: 'resource-2' });
    await controller.deleteSession({ resourceId: 'resource-2' });

    expect(received).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(4);
    error.mockRestore();
  });

  it('does not return a torn-down session when create and delete race', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const original = await controller.createSession({ resourceId: 'resource-1' });
    const threadId = original.thread.requireId();

    // Fire create and delete concurrently for the same resource. Without the
    // race guard, createSession would await the same cached promise as
    // deleteSession and could return the session being torn down.
    const [reused] = await Promise.all([
      controller.createSession({ resourceId: 'resource-1' }),
      controller.deleteSession({ resourceId: 'resource-1' }),
    ]);

    // createSession must not return the original (now torn-down) session.
    expect(reused).not.toBe(original);
    // The returned session should have an active thread (not cleared by abort).
    expect(reused.thread.getId()).toBe(threadId);
  });
});
