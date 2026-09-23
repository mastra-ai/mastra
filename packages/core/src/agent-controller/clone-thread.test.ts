import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

describe('AgentController cloneThread', () => {
  it('prefers session-aware dynamic memory over configured storage when cloning', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const cloneThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'cloned-thread-id',
        resourceId: 'target-resource',
        title: 'Cloned title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
      clonedMessages: [],
      messageIdMap: {},
    });
    let resolvedControllerContext: any;
    const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
      resolvedControllerContext = requestContext.get('controller');
      return Object.assign(new MockMemory(), { cloneThread });
    });

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      initialState: { memoryProfile: 'session-profile' },
      memory: memoryFactory as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await controller.init();
    const memoryStore = await storage.getStore('memory');
    await memoryStore.saveThread({
      thread: {
        id: 'source-thread-id',
        resourceId: 'controller-resource',
        title: 'Source title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });
    const storageCloneThread = vi.spyOn(memoryStore, 'cloneThread');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // The new session's history subscription resolves memory once.
    expect(memoryFactory).toHaveBeenCalledTimes(1);

    const cloned = await session.thread.clone({
      sourceThreadId: 'source-thread-id',
      title: 'New title',
      resourceId: 'target-resource',
    });

    // Once for the clone, and once per history subscription: the new session's thread and the clone.
    expect(memoryFactory).toHaveBeenCalledTimes(3);
    expect(resolvedControllerContext).toMatchObject({
      controllerId: 'test-controller',
      state: { memoryProfile: 'session-profile' },
      session: { id: 'test-session', ownerId: 'test-owner' },
    });
    expect(cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread-id',
      resourceId: 'target-resource',
      title: 'New title',
    });
    expect(storageCloneThread).not.toHaveBeenCalled();
    expect(cloned.id).toBe('cloned-thread-id');
    expect(cloned.resourceId).toBe('target-resource');
  });

  it('uses the raw memory storage clone when configured memory is absent', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await controller.init();
    const memoryStore = await storage.getStore('memory');
    await memoryStore.saveThread({
      thread: {
        id: 'source-thread-id',
        resourceId: 'controller-resource',
        title: 'Source title',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });
    const storageCloneThread = vi.spyOn(memoryStore, 'cloneThread');
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const cloned = await session.thread.clone({
      sourceThreadId: 'source-thread-id',
      title: 'Storage clone',
      resourceId: 'target-resource',
    });

    expect(storageCloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread-id',
      resourceId: 'target-resource',
      title: 'Storage clone',
    });
    expect(cloned.id).not.toBe('source-thread-id');
    expect(cloned.resourceId).toBe('target-resource');
    expect(cloned.title).toBe('Storage clone');
  });

  it('throws when dynamic memory factory returns empty value', async () => {
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      memory: vi.fn().mockResolvedValue(undefined) as unknown as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await controller.init();

    // The session's history subscription resolves memory, so the empty factory surfaces there.
    await expect(controller.createSession({ id: 'test-session', ownerId: 'test-owner' })).rejects.toThrow(
      'Function-based memory returned empty value',
    );
  });
});
