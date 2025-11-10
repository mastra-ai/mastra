import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { MessageList } from '../agent';
import type { MastraMessageV1, StorageThreadType } from '../memory/types';
import { deepMerge } from '../utils';
import { InMemoryStore } from './mock';

describe('InMemoryStore - Thread Sorting', () => {
  let store: InMemoryStore;
  const resourceId = 'test-resource-id';

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create test threads with different dates
    const threads: StorageThreadType[] = [
      {
        id: 'thread-1',
        resourceId,
        title: 'Thread 1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-03T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-2',
        resourceId,
        title: 'Thread 2',
        createdAt: new Date('2024-01-02T10:00:00Z'),
        updatedAt: new Date('2024-01-02T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-3',
        resourceId,
        title: 'Thread 3',
        createdAt: new Date('2024-01-03T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: {},
      },
    ];

    // Save threads to store
    for (const thread of threads) {
      await store.saveThread({ thread });
    }
  });

  describe('listThreadsByResourceId', () => {
    it('should sort by createdAt DESC by default with pagination', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 2,
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by createdAt ASC when specified', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by updatedAt ASC with pagination', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: { field: 'updatedAt', direction: 'ASC' },
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by updatedAt DESC when specified', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-1'); // 2024-01-03 (latest updatedAt)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should maintain sort order across pages', async () => {
      // First page
      const page1 = await store.listThreadsByResourceId({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      // Second page
      const page2 = await store.listThreadsByResourceId({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(page1.threads).toHaveLength(2);
      expect(page1.threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(page1.threads[1].id).toBe('thread-2'); // 2024-01-02

      expect(page2.threads).toHaveLength(1);
      expect(page2.threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
    });

    it('should calculate pagination info correctly after sorting', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].id).toBe('thread-3'); // Last item after sorting
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty results with pagination', async () => {
      const result = await store.listThreadsByResourceId({
        resourceId: 'non-existent-resource',
        page: 0,
        perPage: 10,
      });

      expect(result.threads).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
    it('should filter by resourceId correctly', async () => {
      // Add a thread with different resourceId
      await store.saveThread({
        thread: {
          id: 'thread-other',
          resourceId: 'other-resource',
          title: 'Other Thread',
          createdAt: new Date('2024-01-04T10:00:00Z'),
          updatedAt: new Date('2024-01-04T10:00:00Z'),
          metadata: {},
        },
      });

      const result = await store.listThreadsByResourceId({ resourceId, page: 0, perPage: 2 });

      expect(result.threads).toHaveLength(2);
      expect(result.threads.every(t => t.resourceId === resourceId)).toBe(true);
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });
  });
});

describe('InMemoryStore - Message Fetching', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('listMessages should throw error if threadId is an empty string or whitespace only', async () => {
    await expect(store.listMessages({ threadId: '' })).rejects.toThrow('threadId must be a non-empty string');

    await expect(store.listMessages({ threadId: '   ' })).rejects.toThrow('threadId must be a non-empty string');
  });
});

describe('InMemoryStore - Message Sorting', () => {
  let store: InMemoryStore;
  const threadId = 'test-thread-sorting';
  const resourceId = 'test-resource-sorting';

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create thread first
    await store.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    // Create test messages with different timestamps
    const messages: MastraMessageV1[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'First message',
        type: 'text',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        threadId,
        resourceId,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Second message',
        type: 'text',
        createdAt: new Date('2024-01-01T10:01:00Z'),
        threadId,
        resourceId,
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Third message',
        type: 'text',
        createdAt: new Date('2024-01-01T10:02:00Z'),
        threadId,
        resourceId,
      },
    ];

    // Save messages to store
    const messageList = new MessageList().add(messages, 'memory');
    await store.saveMessages({ messages: messageList.get.all.db() });
  });

  describe('listMessages', () => {
    it('should sort by createdAt ASC by default with pagination', async () => {
      const result = await store.listMessages({
        threadId,
        page: 0,
        perPage: 2,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-1'); // 2024-01-01T10:00:00Z (earliest)
      expect(result.messages[1].id).toBe('msg-2'); // 2024-01-01T10:01:00Z
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by createdAt DESC when specified', async () => {
      const result = await store.listMessages({
        threadId,
        page: 0,
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg-3'); // 2024-01-01T10:02:00Z (latest)
      expect(result.messages[1].id).toBe('msg-2'); // 2024-01-01T10:01:00Z
      expect(result.total).toBe(3);
      expect(result.page).toBe(0);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should fetch all messages when perPage is false', async () => {
      const result = await store.listMessages({
        threadId,
        perPage: false,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].id).toBe('msg-1'); // ASC by default
      expect(result.messages[1].id).toBe('msg-2');
      expect(result.messages[2].id).toBe('msg-3');
      expect(result.total).toBe(3);
      expect(result.perPage).toBe(false);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination correctly with ASC ordering', async () => {
      // First page
      const page1 = await store.listMessages({
        threadId,
        page: 0,
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(page1.messages).toHaveLength(1);
      expect(page1.messages[0].id).toBe('msg-1');
      expect(page1.page).toBe(0);
      expect(page1.hasMore).toBe(true);

      // Second page
      const page2 = await store.listMessages({
        threadId,
        page: 1,
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(page2.messages).toHaveLength(1);
      expect(page2.messages[0].id).toBe('msg-2');
      expect(page2.page).toBe(1);
      expect(page2.hasMore).toBe(true);

      // Third page
      const page3 = await store.listMessages({
        threadId,
        page: 2,
        perPage: 1,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(page3.messages).toHaveLength(1);
      expect(page3.messages[0].id).toBe('msg-3');
      expect(page3.page).toBe(2);
      expect(page3.hasMore).toBe(false);
    });
  });
});

describe('InMemoryStore - listMessagesById', () => {
  let store: InMemoryStore;
  const resourceId = 'test-resource-id';
  const resourceId2 = 'test-resource-id-2';
  let threads: StorageThreadType[] = [];
  let thread1Messages: MastraMessageV1[] = [];
  let thread2Messages: MastraMessageV1[] = [];
  let resource2Messages: MastraMessageV1[] = [];

  let messageCounter = 0;
  const createTestMessageV1 = (text: string, props?: Partial<Omit<MastraMessageV1, 'content'>>): MastraMessageV1 => {
    messageCounter += 1;

    const defaults = {
      id: randomUUID(),
      role: 'user' as const,
      resourceId,
      createdAt: new Date(Date.now() + messageCounter * 1000),
      content: text,
      type: 'text' as const,
    };

    return deepMerge<MastraMessageV1>(defaults, props ?? {});
  };

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create test threads with different dates
    threads = [
      {
        id: 'thread-1',
        resourceId,
        title: 'Thread 1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-03T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-2',
        resourceId,
        title: 'Thread 2',
        createdAt: new Date('2024-01-02T10:00:00Z'),
        updatedAt: new Date('2024-01-02T10:00:00Z'),
        metadata: {},
      },
      {
        id: 'thread-3',
        resourceId: resourceId2,
        title: 'Thread 3',
        createdAt: new Date('2024-01-03T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: {},
      },
    ];

    // Save threads to store
    for (const thread of threads) {
      await store.saveThread({ thread });
    }

    thread1Messages = [
      createTestMessageV1('Message 1', { threadId: threads[0].id, resourceId }),
      createTestMessageV1('Message 2', { threadId: threads[0].id, resourceId }),
    ];

    thread2Messages = [
      createTestMessageV1('Message A', { threadId: threads[1].id, resourceId }),
      createTestMessageV1('Message B', { threadId: threads[1].id, resourceId }),
    ];

    resource2Messages = [
      createTestMessageV1('The quick brown fox jumps over the lazy dog', {
        threadId: threads[2].id,
        resourceId: resourceId2,
      }),
    ];

    await store.saveMessages({ messages: thread1Messages, format: 'v1' });
    await store.saveMessages({ messages: thread2Messages, format: 'v1' });
    await store.saveMessages({ messages: resource2Messages, format: 'v1' });
  });

  it('should return an empty array if no message IDs are provided', async () => {
    const result = await store.listMessagesById({ messageIds: [] });
    expect(result.messages).toHaveLength(0);
  });

  it('should return messages sorted by createdAt DESC', async () => {
    const messageIds = [
      thread1Messages[1]!.id,
      thread2Messages[0]!.id,
      resource2Messages[0]!.id,
      thread1Messages[0]!.id,
      thread2Messages[1]!.id,
    ];
    const result = await store.listMessagesById({
      messageIds,
    });

    expect(result.messages).toHaveLength(thread1Messages.length + thread2Messages.length + resource2Messages.length);
    expect(result.messages.every((msg, i, arr) => i === 0 || msg.createdAt >= arr[i - 1]!.createdAt)).toBe(true);
  });

  it('should return messages by ID', async () => {
    const result = await store.listMessagesById({ messageIds: thread1Messages.map(msg => msg.id) });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.every(MessageList.isMastraDBMessage)).toBe(true);
  });

  it('should return messages from multiple threads', async () => {
    const result = await store.listMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...thread2Messages.map(msg => msg.id)],
    });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.some(msg => msg.threadId === threads[0]?.id)).toBe(true);
    expect(result.messages.some(msg => msg.threadId === threads[1]?.id)).toBe(true);
  });

  it('should return messages from multiple resources', async () => {
    const result = await store.listMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...resource2Messages.map(msg => msg.id)],
    });

    expect(result.messages).toHaveLength(thread1Messages.length + resource2Messages.length);
    expect(result.messages.some(msg => msg.resourceId === threads[0]?.resourceId)).toBe(true);
    expect(result.messages.some(msg => msg.resourceId === threads[2]?.resourceId)).toBe(true);
  });
});
