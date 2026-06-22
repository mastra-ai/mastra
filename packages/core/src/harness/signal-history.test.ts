import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { getDummyResponseModel } from '../agent/__tests__/mock-model';
import { signalToMastraDBMessage } from '../agent/signals';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createTextDbMessage({
  id,
  text,
  threadId,
  resourceId,
  createdAt,
}: {
  id: string;
  text: string;
  threadId: string;
  resourceId: string;
  createdAt: Date;
}) {
  return {
    id,
    role: 'user' as const,
    threadId,
    resourceId,
    createdAt,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
  };
}

describe('Harness signal history rendering', () => {
  async function createHarnessWithThread() {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model: getDummyResponseModel('v2'),
    });
    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    await harness.init();
    const session = await harness.createSession();
    const thread = await session.thread.create({ title: 'Signal thread' });
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) throw new Error('Expected memory storage');

    return { harness, session, memoryStorage, thread };
  }

  it('loads the newest bounded history window even when storage pagination returns the oldest rows', async () => {
    const { session, memoryStorage, thread } = await createHarnessWithThread();
    const messages = Array.from({ length: 5 }, (_, index) =>
      createTextDbMessage({
        id: `message-${index + 1}`,
        text: `message ${index + 1}`,
        threadId: thread.id,
        resourceId: thread.resourceId,
        createdAt: new Date(`2026-06-19T12:00:0${index}.000Z`),
      }),
    );
    await memoryStorage.saveMessages({ messages });

    const originalListMessages = memoryStorage.listMessages.bind(memoryStorage);
    vi.spyOn(memoryStorage, 'listMessages').mockImplementation(async input => {
      if (input.perPage !== false && input.perPage === 2) {
        const all = await originalListMessages({
          ...input,
          perPage: false,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        });
        return { ...all, messages: all.messages.slice(0, 2), perPage: 2, hasMore: true };
      }
      return originalListMessages(input);
    });

    const loaded = await session.thread.listActiveMessages({ limit: 2 });

    expect(loaded.map(message => message.id)).toEqual(['message-4', 'message-5']);
  });

  it('renders persisted user-message signals as user content', async () => {
    const { session, memoryStorage, thread } = await createHarnessWithThread();

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
          { threadId: thread.id, resourceId: 'test-harness' },
        ),
      ],
    });

    const messages = await session.thread.listActiveMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      content: [
        { type: 'text', text: 'hello from signal' },
        { type: 'image', data: 'data:image/png;base64,abc', mimeType: 'image/png' },
      ],
    });
  });

  it('emits agent_end when a system-reminder signal starts an idle run', async () => {
    const { harness, session } = await createHarnessWithThread();
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
      await harness.destroy();
    }
  });

  it('renders persisted system-reminder signals as system reminder content', async () => {
    const { session, memoryStorage, thread } = await createHarnessWithThread();

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
          { threadId: thread.id, resourceId: 'test-harness' },
        ),
      ],
    });

    const messages = await session.thread.listActiveMessages();

    expect(messages).toEqual([
      {
        id: 'signal-reminder-1',
        role: 'user',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        content: [
          {
            type: 'system_reminder',
            message: 'continue from here',
            reminderType: 'temporal-gap',
            path: '/tmp/project',
            precedesMessageId: undefined,
            gapText: undefined,
            gapMs: undefined,
            timestamp: undefined,
            goalMaxTurns: undefined,
            judgeModelId: undefined,
          },
        ],
      },
    ]);
  });
});
