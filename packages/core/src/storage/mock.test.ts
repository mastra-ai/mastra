import { describe, expect, it, beforeEach } from 'vitest';
import type { StorageThreadType } from '../memory/types';
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
