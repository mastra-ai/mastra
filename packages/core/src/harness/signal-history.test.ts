import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { getDummyResponseModel } from '../agent/__tests__/mock-model';
import { signalToMastraDBMessage } from '../agent/signals';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

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
    const thread = await harness.createThread({ title: 'Signal thread' });
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) throw new Error('Expected memory storage');

    return { harness, memoryStorage, thread };
  }

  it('renders persisted user-message signals as user content', async () => {
    const { harness, memoryStorage, thread } = await createHarnessWithThread();

    await memoryStorage.saveMessages({
      messages: [
        signalToMastraDBMessage(
          {
            id: 'signal-user-1',
            type: 'user-message',
            contents: {
              role: 'user',
              content: [
                { type: 'text', text: 'hello from signal' },
                { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
              ],
            },
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
          { threadId: thread.id, resourceId: 'test-harness' },
        ),
      ],
    });

    const messages = await harness.listMessages();

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

  it('renders persisted system-reminder signals as system reminder content', async () => {
    const { harness, memoryStorage, thread } = await createHarnessWithThread();

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

    const messages = await harness.listMessages();

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
