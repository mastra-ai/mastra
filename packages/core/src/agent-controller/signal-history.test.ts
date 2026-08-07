import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { getDummyResponseModel } from '../agent/__tests__/mock-model';
import { signalToMastraDBMessage } from '../agent/signals';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

describe('AgentController signal history rendering', () => {
  async function createControllerWithThread() {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model: getDummyResponseModel('v2'),
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create({ title: 'Signal thread' });
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) throw new Error('Expected memory storage');

    return { controller, session, memoryStorage, thread };
  }

  it('returns persisted user-message signals as DB-native signal messages', async () => {
    const { session, memoryStorage, thread } = await createControllerWithThread();

    await memoryStorage.saveMessages({
      messages: [
        signalToMastraDBMessage(
          {
            id: 'signal-user-1',
            type: 'user-message',
            contents: [
              { type: 'text', text: 'hello from signal' },
              { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
            ],
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
          { threadId: thread.id, resourceId: 'test-controller' },
        ),
      ],
    });

    const messages = await session.thread.listActiveMessages();

    expect(messages).toHaveLength(1);
    // DB-native: no flattening — the persisted signal message is returned verbatim,
    // with role 'signal', nested content.parts, and signal identity on metadata.
    expect(messages[0]).toMatchObject({
      id: 'signal-user-1',
      role: 'signal',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'hello from signal' },
          { type: 'file', data: 'data:image/png;base64,abc', mimeType: 'image/png' },
        ],
        metadata: { signal: { id: 'signal-user-1', type: 'user', tagName: 'user' } },
      },
    });
  });

  it('emits agent_end when a system-reminder signal starts an idle run', async () => {
    const { controller, session } = await createControllerWithThread();
    const events: Array<{ type: string; reason?: string }> = [];
    const unsubscribe = session.subscribe(event => {
      events.push(event as { type: string; reason?: string });
    });

    try {
      const signal = session.sendSignal({
        type: 'system-reminder',
        contents: 'keep going',
        attributes: { type: 'goal' },
      });
      await signal.accepted;

      await vi.waitFor(() => {
        expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true);
      });
    } finally {
      unsubscribe();
      await controller.destroy();
    }
  });

  it('returns persisted system-reminder signals as DB-native signal messages', async () => {
    const { session, memoryStorage, thread } = await createControllerWithThread();

    await memoryStorage.saveMessages({
      messages: [
        signalToMastraDBMessage(
          {
            id: 'signal-reminder-1',
            type: 'system-reminder',
            contents: 'continue from here',
            attributes: { type: 'temporal-gap', path: '/tmp/project' },
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
          { threadId: thread.id, resourceId: 'test-controller' },
        ),
      ],
    });

    const messages = await session.thread.listActiveMessages();

    expect(messages).toHaveLength(1);
    // DB-native: the reminder is a 'signal'-role message whose content.parts carry the
    // text, and the signal identity/attributes live on content.metadata.signal.
    expect(messages[0]).toMatchObject({
      id: 'signal-reminder-1',
      role: 'signal',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'continue from here' }],
        metadata: {
          signal: {
            id: 'signal-reminder-1',
            type: 'reactive',
            tagName: 'system-reminder',
            attributes: { type: 'temporal-gap', path: '/tmp/project' },
          },
        },
      },
    });
  });
});
