import type { StorageThreadType } from '@mastra/core';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { describe, test, expect, afterEach } from 'vitest';
import { api } from '../../convex/_generated/api';
import { ConvexStorage } from './index';

describe('ConvexStorage Thread Tests', () => {
  // Initialize ConvexStorage with local Convex instance
  const storage = new ConvexStorage({
    convexUrl: 'http://localhost:3210',
    api,
  });

  // Clean up after each test
  // afterEach(async () => {
  //   await storage.clearTable({ tableName: 'threads' as unknown as TABLE_NAMES });
  // });

  test('should save a new thread', async () => {
    // Arrange
    const thread: StorageThreadType = {
      id: 'test-thread-id-1',
      title: 'Test Thread',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { testKey: 'testValue' },
      resourceId: 'test-resource-id',
    };

    const savedThread = await storage.saveThread({ thread });

    expect(savedThread).toBeDefined();
    expect(savedThread.id).toBe(thread.id);
    expect(savedThread.title).toBe(thread.title);
    expect(savedThread.resourceId).toBe(thread.resourceId);
    expect(savedThread.metadata).toEqual(thread.metadata);
  });

  test('should get a thread by id', async () => {
    // Arrange
    const thread: StorageThreadType = {
      id: 'test-thread-id-2',
      title: 'Test Get Thread',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { testKey: 'testValue' },
      resourceId: 'test-resource-id',
    };
    await storage.saveThread({ thread });

    const retrievedThread = await storage.getThreadById({ threadId: thread.id });

    expect(retrievedThread).not.toBeNull();
    expect(retrievedThread?.id).toBe(thread.id);
    expect(retrievedThread?.title).toBe(thread.title);
  });

  test('should return null when getting non-existent thread', async () => {
    const retrievedThread = await storage.getThreadById({ threadId: 'non-existent-id' });

    expect(retrievedThread).toBeNull();
  });

  test('should get threads by resource id', async () => {
    const resourceId = 'shared-resource-id';
    const thread1: StorageThreadType = {
      id: 'test-thread-id-3',
      title: 'Test Thread 1',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { testKey: 'testValue1' },
      resourceId,
    };
    const thread2: StorageThreadType = {
      id: 'test-thread-id-4',
      title: 'Test Thread 2',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { testKey: 'testValue2' },
      resourceId,
    };
    await storage.saveThread({ thread: thread1 });
    await storage.saveThread({ thread: thread2 });

    const threads = await storage.getThreadsByResourceId({ resourceId });

    expect(threads).toHaveLength(2);
    expect(threads.map(t => t.id).sort()).toEqual([thread1.id, thread2.id].sort());
  });

  test('should update a thread', async () => {
    const thread: StorageThreadType = {
      id: 'test-thread-id-5',
      title: 'Original Title',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { originalKey: 'originalValue' },
      resourceId: 'test-resource-id',
    };
    await storage.saveThread({ thread });

    const updatedThread = await storage.updateThread({
      id: thread.id,
      title: 'Updated Title',
      metadata: { updatedKey: 'updatedValue' },
    });

    expect(updatedThread).toBeDefined();
    expect(updatedThread.id).toBe(thread.id);
    expect(updatedThread.title).toBe('Updated Title');
    expect(updatedThread.metadata).toEqual({ updatedKey: 'updatedValue' });

    const retrievedThread = await storage.getThreadById({ threadId: thread.id });
    expect(retrievedThread?.title).toBe('Updated Title');
    expect(retrievedThread?.metadata).toEqual({ updatedKey: 'updatedValue' });
  });

  test('should delete a thread', async () => {
    const thread: StorageThreadType = {
      id: 'test-thread-id-6',
      title: 'Thread To Delete',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { testKey: 'testValue' },
      resourceId: 'test-resource-id',
    };
    await storage.saveThread({ thread });

    const beforeDelete = await storage.getThreadById({ threadId: thread.id });
    expect(beforeDelete).not.toBeNull();

    await storage.deleteThread({ threadId: thread.id });

    const afterDelete = await storage.getThreadById({ threadId: thread.id });
    expect(afterDelete).toBeNull();
  });

  test('should save multiple threads and retrieve them correctly', async () => {
    const threads: StorageThreadType[] = [
      {
        id: 'multi-thread-id-1',
        title: 'Multi Thread 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { index: 1 },
        resourceId: 'multi-resource-id',
      },
      {
        id: 'multi-thread-id-2',
        title: 'Multi Thread 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { index: 2 },
        resourceId: 'multi-resource-id',
      },
      {
        id: 'multi-thread-id-3',
        title: 'Multi Thread 3',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { index: 3 },
        resourceId: 'another-resource-id',
      },
    ];

    for (const thread of threads) {
      await storage.saveThread({ thread });
    }
    const resourceThreads = await storage.getThreadsByResourceId({ resourceId: 'multi-resource-id' });
    expect(resourceThreads).toHaveLength(2);

    const anotherResourceThreads = await storage.getThreadsByResourceId({ resourceId: 'another-resource-id' });
    expect(anotherResourceThreads).toHaveLength(1);
    expect(anotherResourceThreads[0].id).toBe('multi-thread-id-3');

    for (const thread of threads) {
      const retrievedThread = await storage.getThreadById({ threadId: thread.id });
      expect(retrievedThread).not.toBeNull();
      expect(retrievedThread?.title).toBe(thread.title);
      expect(retrievedThread?.metadata).toEqual(thread.metadata);
    }
  });
});
