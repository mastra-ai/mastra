import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { Memory } from './index';

describe('cloneThread – hydrateMessages', () => {
  let memory: Memory;
  const resourceId = 'hydrate-test-resource';

  beforeEach(() => {
    memory = new Memory({ storage: new InMemoryStore() });
  });

  async function seedThread(threadId: string, messageCount: number) {
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Hydrate Test Thread',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    const messages: MastraDBMessage[] = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg-${threadId}-${i}`,
        threadId,
        resourceId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: `Message ${i}` }] },
        createdAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      });
    }
    await memory.saveMessages({ messages });
  }

  it('hydrates cloned messages by default', async () => {
    await seedThread('src-hydrate-default', 3);

    const { clonedMessages, messageIdMap } = await memory.cloneThread({
      sourceThreadId: 'src-hydrate-default',
    });

    expect(clonedMessages).toHaveLength(3);
    expect(Object.keys(messageIdMap ?? {})).toHaveLength(3);
  });

  it('returns empty clonedMessages when hydrateMessages is false but still copies messages', async () => {
    await seedThread('src-hydrate-off', 3);

    const {
      thread: clonedThread,
      clonedMessages,
      messageIdMap,
    } = await memory.cloneThread({
      sourceThreadId: 'src-hydrate-off',
      options: { hydrateMessages: false },
    });

    // No payloads returned to the JS heap.
    expect(clonedMessages).toEqual([]);
    // But the id map is still produced.
    expect(Object.keys(messageIdMap ?? {})).toHaveLength(3);

    // The destination thread still contains the copied messages.
    const memoryStore = (await memory.storage.getStore('memory'))!;
    const { messages } = await memoryStore.listMessages({
      threadId: clonedThread.id,
      resourceId,
    });
    expect(messages).toHaveLength(3);
  });
});
