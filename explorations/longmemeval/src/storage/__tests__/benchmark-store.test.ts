import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BenchmarkStore } from '../benchmark-store';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BenchmarkStore', () => {
  let store: BenchmarkStore;
  let testFilePath: string;

  beforeEach(async () => {
    store = new BenchmarkStore();
    await store.init();
    testFilePath = join(tmpdir(), `benchmark-store-test-${Date.now()}.json`);
  });

  afterEach(async () => {
    // Clean up test files
    if (existsSync(testFilePath)) {
      await rm(testFilePath);
    }
  });

  describe('supports', () => {
    it('should support resource scope and working memory', () => {
      expect(store.supports.selectByIncludeResourceScope).toBe(true);
      expect(store.supports.resourceWorkingMemory).toBe(true);
    });
  });

  describe('persist', () => {
    it('should save store data to a JSON file', async () => {
      // Add some test data
      await store.saveThread({
        thread: {
          id: 'test-thread-1',
          resourceId: 'test-resource-1',
          title: 'Test Thread',
          metadata: { test: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await store.saveMessages({
        messages: [
          {
            id: 'msg-1',
            threadId: 'test-thread-1',
            resourceId: 'test-resource-1',
            role: 'user' as const,
            content: 'Hello',
            createdAt: new Date(),
            type: 'text' as const,
          },
          {
            id: 'msg-2',
            threadId: 'test-thread-1',
            resourceId: 'test-resource-1',
            role: 'assistant' as const,
            content: 'Hi there!',
            createdAt: new Date(),
            type: 'text' as const,
          },
        ],
      });

      // Persist to file
      await store.persist(testFilePath);

      // Verify file exists
      expect(existsSync(testFilePath)).toBe(true);
    });
  });

  describe('hydrate', () => {
    it('should restore store data from a JSON file', async () => {
      // Create first store with data
      const store1 = new BenchmarkStore();
      await store1.init();

      const thread = {
        id: 'test-thread-1',
        resourceId: 'test-resource-1',
        title: 'Test Thread',
        metadata: { test: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store1.saveThread({ thread });
      await store1.saveMessages({
        messages: [
          {
            id: 'msg-1',
            threadId: 'test-thread-1',
            resourceId: 'test-resource-1',
            role: 'user' as const,
            content: 'Hello',
            createdAt: new Date(),
            type: 'text' as const,
          },
        ],
      });

      // Persist store1
      await store1.persist(testFilePath);

      // Create new store and hydrate
      const store2 = new BenchmarkStore();
      await store2.init();
      await store2.hydrate(testFilePath);

      // Verify data was restored
      const restoredThread = await store2.getThreadById({ threadId: 'test-thread-1' });
      expect(restoredThread).toBeTruthy();
      expect(restoredThread?.title).toBe('Test Thread');

      const restoredMessages = await store2.getMessages({ threadId: 'test-thread-1' });
      expect(restoredMessages).toHaveLength(1);
      expect(restoredMessages[0].content).toBe('Hello');
    });

    it('should throw error if file does not exist', async () => {
      await expect(store.hydrate('/non/existent/file.json')).rejects.toThrow('Storage file not found');
    });
  });

  describe('cross-thread queries (resource scope)', () => {
    it('should support selectBy.include with different threadIds', async () => {
      // Create messages in different threads but same resource
      await store.saveThread({
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'Thread 1',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await store.saveThread({
        thread: {
          id: 'thread-2',
          resourceId: 'resource-1',
          title: 'Thread 2',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await store.saveMessages({
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-1',
            resourceId: 'resource-1',
            role: 'user' as const,
            content: 'Message in thread 1',
            createdAt: new Date('2024-01-01'),
            type: 'text' as const,
          },
          {
            id: 'msg-2',
            threadId: 'thread-2',
            resourceId: 'resource-1',
            role: 'user' as const,
            content: 'Message in thread 2',
            createdAt: new Date('2024-01-02'),
            type: 'text' as const,
          },
          {
            id: 'msg-3',
            threadId: 'thread-2',
            resourceId: 'resource-1',
            role: 'assistant' as const,
            content: 'Response in thread 2',
            createdAt: new Date('2024-01-03'),
            type: 'text' as const,
          },
        ],
      });

      // Query using selectBy.include to get messages from different threads
      const messages = await store.getMessages({
        threadId: 'thread-1',
        selectBy: {
          include: [
            {
              id: 'msg-2',
              threadId: 'thread-2', // Different thread!
              withPreviousMessages: 0,
              withNextMessages: 1,
            },
          ],
        },
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Message in thread 2');
      expect(messages[1].content).toBe('Response in thread 2');
    });
  });

  describe('resource operations', () => {
    it('should support resource working memory', async () => {
      const resource = await store.saveResource({
        resource: {
          id: 'resource-1',
          workingMemory: 'Initial working memory',
          metadata: { key: 'value' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(resource.workingMemory).toBe('Initial working memory');

      // Update resource
      const updated = await store.updateResource({
        resourceId: 'resource-1',
        workingMemory: 'Updated working memory',
        metadata: { key: 'newValue', extra: 'data' },
      });

      expect(updated.workingMemory).toBe('Updated working memory');
      expect(updated.metadata).toEqual({ key: 'newValue', extra: 'data' });

      // Get resource
      const retrieved = await store.getResourceById({ resourceId: 'resource-1' });
      expect(retrieved?.workingMemory).toBe('Updated working memory');
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      // Add data
      await store.saveThread({
        thread: {
          id: 'test-thread-1',
          resourceId: 'test-resource-1',
          title: 'Test Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Clear
      await store.clear();

      // Verify data is gone
      const thread = await store.getThreadById({ threadId: 'test-thread-1' });
      expect(thread).toBeNull();
    });
  });

  describe('getting messages', () => {
    it('should throw when threadId is an empty string or whitespace only', async () => {
      await expect(() => store.getMessages({ threadId: '' })).rejects.toThrowError(
        'threadId must be a non-empty string',
      );

      await expect(() => store.getMessagesPaginated({ threadId: '' })).rejects.toThrowError(
        'threadId must be a non-empty string',
      );

      await expect(() => store.getMessages({ threadId: '   ' })).rejects.toThrowError(
        'threadId must be a non-empty string',
      );

      await expect(() => store.getMessagesPaginated({ threadId: '   ' })).rejects.toThrowError(
        'threadId must be a non-empty string',
      );
    });
  });
});
