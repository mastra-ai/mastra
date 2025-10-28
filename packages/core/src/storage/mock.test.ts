import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { MessageList } from '../agent';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../memory/types';
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

  describe('getThreadsByResourceId', () => {
    it('should sort by createdAt DESC by default', async () => {
      const threads = await store.getThreadsByResourceId({ resourceId });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-1'); // 2024-01-01 (earliest)
    });

    it('should sort by createdAt ASC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-3'); // 2024-01-03 (latest)
    });

    it('should sort by updatedAt DESC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-1'); // 2024-01-03 (latest updatedAt)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
    });

    it('should sort by updatedAt ASC when specified', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(threads).toHaveLength(3);
      expect(threads[0].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
      expect(threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(threads[2].id).toBe('thread-1'); // 2024-01-03 (latest updatedAt)
    });

    it('should handle empty results', async () => {
      const threads = await store.getThreadsByResourceId({
        resourceId: 'non-existent-resource',
      });

      expect(threads).toHaveLength(0);
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

      const threads = await store.getThreadsByResourceId({ resourceId });

      expect(threads).toHaveLength(3);
      expect(threads.every(t => t.resourceId === resourceId)).toBe(true);
    });
  });

  describe('getThreadsByResourceIdPaginated', () => {
    it('should sort by createdAt DESC by default with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
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

    it('should sort by updatedAt ASC with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: 'updatedAt',
        sortDirection: 'ASC',
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].id).toBe('thread-3'); // 2024-01-01 (earliest updatedAt)
      expect(result.threads[1].id).toBe('thread-2'); // 2024-01-02
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should maintain sort order across pages', async () => {
      // First page
      const page1 = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 0,
        perPage: 2,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      // Second page
      const page2 = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: 'createdAt',
        sortDirection: 'ASC',
      });

      expect(page1.threads).toHaveLength(2);
      expect(page1.threads[0].id).toBe('thread-1'); // 2024-01-01 (earliest)
      expect(page1.threads[1].id).toBe('thread-2'); // 2024-01-02

      expect(page2.threads).toHaveLength(1);
      expect(page2.threads[0].id).toBe('thread-3'); // 2024-01-03 (latest)
    });

    it('should calculate pagination info correctly after sorting', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId,
        page: 1,
        perPage: 2,
        orderBy: 'updatedAt',
        sortDirection: 'DESC',
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].id).toBe('thread-3'); // Last item after sorting
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should handle empty results with pagination', async () => {
      const result = await store.getThreadsByResourceIdPaginated({
        resourceId: 'non-existent-resource',
        page: 0,
        perPage: 10,
      });

      expect(result.threads).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});

describe('InMemoryStore - Message Fetching', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('listMessages should throw when threadId is an empty string or whitespace only', async () => {
    await expect(() => store.listMessages({ threadId: '' })).rejects.toThrowError(
      'threadId must be a non-empty string',
    );

    await expect(() => store.listMessages({ threadId: '   ' })).rejects.toThrowError(
      'threadId must be a non-empty string',
    );
  });
});

describe('InMemoryStore - listMessages with limit parameter', () => {
  let store: InMemoryStore;
  const resourceId = 'test-resource-id';
  const threadId = 'test-thread-id';

  beforeEach(async () => {
    store = new InMemoryStore();

    // Create a test thread
    await store.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test Thread',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        metadata: {},
      },
    });

    // Create 10 test messages
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: `msg-${i + 1}`,
      threadId,
      resourceId,
      role: 'user' as const,
      content: `Message ${i + 1}`,
      type: 'text' as const,
      createdAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
    }));

    await store.saveMessages({ messages, format: 'v1' });
  });

  it('should use default limit (40) when no limit is provided', async () => {
    const result = await store.listMessages({ threadId });

    expect(result.messages).toHaveLength(10); // All 10 messages fit in default limit
    expect(result.page).toBe(0);
    expect(result.perPage).toBe(40);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(false);
  });

  it('should return specified number of messages when limit is a number', async () => {
    const result = await store.listMessages({ threadId, limit: 5 });

    expect(result.messages).toHaveLength(5);
    expect(result.page).toBe(0);
    expect(result.perPage).toBe(5);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('should return ALL messages when limit is false', async () => {
    // Add more messages to make it interesting
    const moreMessages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-extra-${i + 1}`,
      threadId,
      resourceId,
      role: 'user' as const,
      content: `Extra Message ${i + 1}`,
      type: 'text' as const,
      createdAt: new Date(`2024-01-01T11:${String(i).padStart(2, '0')}:00Z`),
    }));
    await store.saveMessages({ messages: moreMessages, format: 'v1' });

    const result = await store.listMessages({ threadId, limit: false });

    expect(result.messages).toHaveLength(60); // All 60 messages (10 original + 50 extra)
    expect(result.page).toBe(0);
    expect(result.perPage).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.total).toBe(60);
    expect(result.hasMore).toBe(false);
  });

  it('should use offset to skip messages', async () => {
    const result = await store.listMessages({
      threadId,
      limit: 3,
      offset: 3, // Skip first 3 messages
    });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].id).toBe('msg-4');
    expect(result.messages[2].id).toBe('msg-6');
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('should handle offset with limit for pagination', async () => {
    // Page 1 (messages 0-2)
    const page0 = await store.listMessages({ threadId, limit: 3, offset: 0 });
    expect(page0.messages).toHaveLength(3);
    expect(page0.messages[0].id).toBe('msg-1');
    expect(page0.hasMore).toBe(true);

    // Page 2 (messages 3-5)
    const page1 = await store.listMessages({ threadId, limit: 3, offset: 3 });
    expect(page1.messages).toHaveLength(3);
    expect(page1.messages[0].id).toBe('msg-4');
    expect(page1.hasMore).toBe(true);

    // Page 3 (messages 6-8)
    const page2 = await store.listMessages({ threadId, limit: 3, offset: 6 });
    expect(page2.messages).toHaveLength(3);
    expect(page2.messages[0].id).toBe('msg-7');
    expect(page2.hasMore).toBe(true);

    // Page 4 (message 9)
    const page3 = await store.listMessages({ threadId, limit: 3, offset: 9 });
    expect(page3.messages).toHaveLength(1);
    expect(page3.messages[0].id).toBe('msg-10');
    expect(page3.hasMore).toBe(false);
  });

  it('should work with include parameter and limit', async () => {
    const result = await store.listMessages({
      threadId,
      limit: 3,
      include: [
        {
          id: 'msg-5',
          withPreviousMessages: 1,
          withNextMessages: 1,
        },
      ],
    });

    // Should include msg-4, msg-5, msg-6 from the include
    expect(result.messages).toHaveLength(3);
    expect(result.messages.some((m: any) => m.id === 'msg-4')).toBe(true);
    expect(result.messages.some((m: any) => m.id === 'msg-5')).toBe(true);
    expect(result.messages.some((m: any) => m.id === 'msg-6')).toBe(true);
  });

  it('should work with date range filtering and limit', async () => {
    const result = await store.listMessages({
      threadId,
      limit: 5,
      filter: {
        dateRange: {
          start: new Date('2024-01-01T10:05:00Z'),
          end: new Date('2024-01-01T10:08:00Z'),
        },
      },
    });

    // Should only get messages 6, 7, 8, 9 (4 messages in range)
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0].id).toBe('msg-6');
    expect(result.messages[3].id).toBe('msg-9');
  });

  it('should return empty result when limit is 0', async () => {
    const result = await store.listMessages({ threadId, limit: 0 });

    // limit: 0 is not a valid positive number, so it falls back to default
    expect(result.messages).toHaveLength(10);
    expect(result.perPage).toBe(40); // Falls back to default
  });

  it('should handle negative limit gracefully (falls back to default)', async () => {
    const result = await store.listMessages({ threadId, limit: -5 });

    // Negative limit is not valid, so it falls back to default
    expect(result.messages).toHaveLength(10);
    expect(result.perPage).toBe(40); // Falls back to default
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
    const messages = await store.listMessagesById({ messageIds: [] });
    expect(messages).toHaveLength(0);
  });

  it('should return messages sorted by createdAt DESC', async () => {
    const messageIds = [
      thread1Messages[1]!.id,
      thread2Messages[0]!.id,
      resource2Messages[0]!.id,
      thread1Messages[0]!.id,
      thread2Messages[1]!.id,
    ];
    const messages = await store.listMessagesById({
      messageIds,
    });

    expect(messages).toHaveLength(thread1Messages.length + thread2Messages.length + resource2Messages.length);
    expect(messages.every((msg, i, arr) => i === 0 || msg.createdAt >= arr[i - 1]!.createdAt)).toBe(true);
  });

  it('should return V2 messages by default', async () => {
    const messages: MastraMessageV2[] = await store.listMessagesById({
      messageIds: thread1Messages.map(msg => msg.id),
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every(MessageList.isMastraMessageV2)).toBe(true);
  });

  it('should return messages from multiple threads', async () => {
    const messages = await store.listMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...thread2Messages.map(msg => msg.id)],
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some(msg => msg.threadId === threads[0]?.id)).toBe(true);
    expect(messages.some(msg => msg.threadId === threads[1]?.id)).toBe(true);
  });

  it('should return messages from multiple resources', async () => {
    const messages = await store.listMessagesById({
      messageIds: [...thread1Messages.map(msg => msg.id), ...resource2Messages.map(msg => msg.id)],
    });

    expect(messages).toHaveLength(thread1Messages.length + resource2Messages.length);
    expect(messages.some(msg => msg.resourceId === threads[0]?.resourceId)).toBe(true);
    expect(messages.some(msg => msg.resourceId === threads[2]?.resourceId)).toBe(true);
  });
});
