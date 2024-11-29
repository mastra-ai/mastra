import { ThreadType, MessageType } from '@mastra/core';

import { LocalRedisProvider, RedisMemory } from './';

describe('RedisMemory', () => {
  let memory: RedisMemory;
  let provider: LocalRedisProvider;

  beforeAll(async () => {
    provider = new LocalRedisProvider();
    memory = new RedisMemory(provider);
  });

  afterAll(async () => {
    await memory.cleanup();
    await provider.quit();
  });

  beforeEach(async () => {
    await provider.flushall();
  });

  describe('Thread Operations', () => {
    it('should create a thread with metadata', async () => {
      const thread = await memory.createThread('Test Thread', {
        testKey: 'testValue',
      });

      expect(thread).toEqual({
        id: expect.any(String),
        title: 'Test Thread',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        metadata: { testKey: 'testValue' },
      });
    });

    it('should retrieve a created thread', async () => {
      const created = await memory.createThread('Test Thread');
      const retrieved = await memory.getThreadById(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent thread', async () => {
      const thread = await memory.getThreadById('nonexistent');
      expect(thread).toBeNull();
    });

    it('should update thread title', async () => {
      const thread = await memory.createThread('Initial Title');
      thread.title = 'Updated Title';

      await memory.saveThread(thread);
      const retrieved = await memory.getThreadById(thread.id);

      expect(retrieved?.title).toBe('Updated Title');
    });
  });

  describe('Message Operations', () => {
    let testThread: ThreadType;

    beforeEach(async () => {
      testThread = await memory.createThread('Test Thread');
    });

    it('should add a single message', async () => {
      const message = await memory.addMessage(testThread.id, 'Hello World', 'user');

      const messages = await memory.getMessages(testThread.id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it('should maintain message order', async () => {
      await memory.addMessage(testThread.id, 'First', 'user');
      await memory.addMessage(testThread.id, 'Second', 'assistant');
      await memory.addMessage(testThread.id, 'Third', 'user');

      const messages = await memory.getMessages(testThread.id);
      expect(messages).toHaveLength(3);
      expect(messages.map(m => m.content)).toEqual(['First', 'Second', 'Third']);
    });

    it('should handle bulk message saves', async () => {
      const messages: MessageType[] = [
        {
          id: 'msg1',
          threadId: testThread.id,
          content: 'Message 1',
          role: 'user',
          createdAt: new Date(),
        },
        {
          id: 'msg2',
          threadId: testThread.id,
          content: 'Message 2',
          role: 'assistant',
          createdAt: new Date(),
        },
      ];

      await memory.saveMessages(messages);
      const retrieved = await memory.getMessages(testThread.id);
      expect(retrieved).toHaveLength(2);
    });

    it('should prevent duplicate messages', async () => {
      const message = await memory.addMessage(testThread.id, 'Test', 'user');
      await memory.saveMessages([message]); // Try to save the same message again

      const messages = await memory.getMessages(testThread.id);
      expect(messages).toHaveLength(1);
    });
  });

  describe('Thread Management', () => {
    it('should list all thread IDs', async () => {
      const thread1 = await memory.createThread('Thread 1');
      const thread2 = await memory.createThread('Thread 2');

      const ids = await memory.getAllThreadIds();
      expect(ids).toContain(thread1.id);
      expect(ids).toContain(thread2.id);
    });

    it('should delete thread and its messages', async () => {
      const thread = await memory.createThread('Delete Test');
      await memory.addMessage(thread.id, 'Test Message', 'user');

      await memory.deleteThread(thread.id);

      const deletedThread = await memory.getThreadById(thread.id);
      const messages = await memory.getMessages(thread.id);

      expect(deletedThread).toBeNull();
      expect(messages).toHaveLength(0);
    });

    it('should retrieve multiple threads', async () => {
      const thread1 = await memory.createThread('Thread 1');
      const thread2 = await memory.createThread('Thread 2');

      const threads = await memory.getThreads([thread1.id, thread2.id]);
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.title)).toEqual(['Thread 1', 'Thread 2']);
    });
  });

  describe('Error Handling', () => {
    it('should handle saving messages to non-existent thread', async () => {
      const message: MessageType = {
        id: 'test',
        threadId: 'nonexistent',
        content: 'Test',
        role: 'user',
        createdAt: new Date(),
      };

      await memory.saveMessages([message]);
      const messages = await memory.getMessages('nonexistent');
      expect(messages).toHaveLength(1);
    });

    it('should handle concurrent message saves', async () => {
      const thread = await memory.createThread('Concurrent Test');

      // Simulate concurrent saves
      await Promise.all([
        memory.addMessage(thread.id, 'Message 1', 'user'),
        memory.addMessage(thread.id, 'Message 2', 'user'),
        memory.addMessage(thread.id, 'Message 3', 'user'),
      ]);

      const messages = await memory.getMessages(thread.id);
      expect(messages).toHaveLength(3);
    });
  });

  describe('Performance', () => {
    it('should handle large number of messages', async () => {
      const thread = await memory.createThread('Bulk Test');
      const messageCount = 100;

      // Create messages array first
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: memory['generateId'](),
        content: `Message ${i}`,
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        createdAt: new Date(),
        threadId: thread.id,
      }));

      // Save all messages in one operation
      await memory.saveMessages(messages);

      const retrievedMessages = await memory.getMessages(thread.id);
      expect(retrievedMessages).toHaveLength(messageCount);

      // Verify message content and ordering
      const sortedMessages = retrievedMessages.sort((a, b) => {
        const aNum = parseInt(a.content.split(' ')[1] || '0');
        const bNum = parseInt(b.content.split(' ')[1] || '0');
        return aNum - bNum;
      });

      sortedMessages.forEach((msg, i) => {
        expect(msg.content).toBe(`Message ${i}`);
      });
    });

    // Add a test for truly concurrent operations
    it('should handle concurrent batch saves', async () => {
      const thread = await memory.createThread('Concurrent Batch Test');
      const batchSize = 20;
      const numberOfBatches = 5;

      // Create batches of messages
      const batches = Array.from({ length: numberOfBatches }, (_, batchIndex) =>
        Array.from({ length: batchSize }, (_, i) => ({
          id: memory['generateId'](),
          content: `Batch ${batchIndex} Message ${i}`,
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          createdAt: new Date(),
          threadId: thread.id,
        })),
      );

      // Save batches concurrently
      await Promise.all(batches.map(batch => memory.saveMessages(batch)));

      const messages = await memory.getMessages(thread.id);
      expect(messages).toHaveLength(batchSize * numberOfBatches);

      // Verify all messages are present
      const messageSet = new Set(messages.map(m => m.content));
      for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
        for (let i = 0; i < batchSize; i++) {
          expect(messageSet.has(`Batch ${batchIndex} Message ${i}`)).toBeTruthy();
        }
      }
    });
  });
});
