import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace, createTestAgent, createTestController } from './test-utils';

describe('AgentController queryThreadMessages', () => {
  it('forwards memory pagination, ordering, filters, includes, and resource scope through inherited storage', async () => {
    const controllerStore = new InMemoryStore();
    const parentStore = new InMemoryStore();
    const controller = createTestController({ storage: controllerStore });
    new Mastra({ agentControllers: { code: controller }, storage: parentStore });

    const threadId = 'parent-thread';
    const parentMemory = await parentStore.getStore('memory');
    await parentMemory!.saveMessages({
      messages: [
        ['first', '2026-01-01T00:00:00.000Z', 'parent-user', 'keep'],
        ['second', '2026-01-02T00:00:00.000Z', 'parent-user', 'discard'],
        ['third', '2026-01-03T00:00:00.000Z', 'parent-user', 'keep'],
        ['other-resource', '2026-01-04T00:00:00.000Z', 'other-user', 'keep'],
      ].map(([id, createdAt, resourceId, category]) => ({
        id,
        role: 'user',
        threadId,
        resourceId,
        createdAt: new Date(createdAt),
        content: { format: 2, parts: [{ type: 'text', text: id }], metadata: { category } },
      })) as any,
    });

    const initStorage = vi.spyOn(controller, 'initStorage');
    const createSession = vi.spyOn(controller, 'createSession');
    try {
      const paged = await controller.queryThreadMessages({
        threadId,
        resourceId: 'parent-user',
        page: 1,
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const filtered = await controller.queryThreadMessages({
        threadId,
        resourceId: 'parent-user',
        perPage: false,
        filter: {
          dateRange: { start: new Date('2026-01-02T00:00:00.000Z') },
          metadata: { category: 'keep' },
        },
      });
      const included = await controller.queryThreadMessages({
        threadId,
        resourceId: 'parent-user',
        perPage: 0,
        include: [{ id: 'third', withPreviousMessages: 1 }],
      });

      expect(paged).toMatchObject({ total: 3, page: 1, perPage: 1, hasMore: true });
      expect(paged.messages.map(message => message.id)).toEqual(['second']);
      expect(filtered.messages.map(message => message.id)).toEqual(['third']);
      expect(included.messages.map(message => message.id)).toEqual(['third', 'second']);
      expect(initStorage).toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();

      const controllerMemory = await controllerStore.getStore('memory');
      expect((await controllerMemory!.listMessages({ threadId, perPage: false })).messages).toEqual([]);
    } finally {
      initStorage.mockRestore();
      createSession.mockRestore();
    }
  });

  it('returns an empty result using storage pagination defaults when storage is unavailable', async () => {
    const controller = new AgentController({
      id: 'no-storage-controller',
      workspace: createMockWorkspace(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: createTestAgent(),
        },
      ],
    });

    await expect(controller.queryThreadMessages({ threadId: 'missing', page: 2 })).resolves.toEqual({
      messages: [],
      total: 0,
      page: 2,
      perPage: 40,
      hasMore: false,
    });
  });

  it('keeps Session thread reads array-returning and newest-window chronological', async () => {
    const store = new InMemoryStore();
    const controller = createTestController({ storage: store });
    await controller.init();
    const session = await controller.createSession({ resourceId: 'session-user' });
    const threadId = session.thread.requireId();
    const memory = await store.getStore('memory');
    await memory!.saveMessages({
      messages: ['first', 'second', 'third'].map((id, index) => ({
        id,
        role: 'user',
        threadId,
        resourceId: 'session-user',
        createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
        content: { format: 2, parts: [{ type: 'text', text: id }] },
      })) as any,
    });

    await expect(session.thread.listMessages({ threadId })).resolves.toMatchObject([
      { id: 'first' },
      { id: 'second' },
      { id: 'third' },
    ]);
    await expect(session.thread.listMessages({ threadId, limit: 2 })).resolves.toMatchObject([
      { id: 'second' },
      { id: 'third' },
    ]);
  });
});
