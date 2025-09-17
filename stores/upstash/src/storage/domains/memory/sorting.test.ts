import { describe, it, expect } from 'vitest';
import type { StorageThreadType } from '@mastra/core/memory';
import { StoreMemoryUpstash } from './index';

describe('StoreMemoryUpstash sorting functionality', () => {
  // Create a mock instance to test the sortThreads method
  const mockClient = {} as any;
  const mockOperations = {} as any;
  const memoryStore = new StoreMemoryUpstash({ client: mockClient, operations: mockOperations });

  // Access the private sortThreads method for testing
  const sortThreads = (memoryStore as any).sortThreads.bind(memoryStore);
  const castThreadOrderBy = (memoryStore as any).castThreadOrderBy.bind(memoryStore);
  const castThreadSortDirection = (memoryStore as any).castThreadSortDirection.bind(memoryStore);

  const testThreads: StorageThreadType[] = [
    {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Final Test Update 2025',
      createdAt: new Date('2025-09-10T23:24:11.004Z'),
      updatedAt: new Date('2025-09-11T01:04:12.265Z'),
      metadata: {},
    },
    {
      id: 'thread-2',
      resourceId: 'resource-1',
      title: 'Server Test: Verify Sidebar Update',
      createdAt: new Date('2025-09-10T23:22:14.032Z'),
      updatedAt: new Date('2025-09-11T19:07:24.186Z'),
      metadata: {},
    },
  ];

  describe('sortThreads method', () => {
    it('should sort threads by updatedAt DESC correctly', () => {
      const sorted = sortThreads([...testThreads], 'updatedAt', 'DESC');
      
      expect(sorted).toHaveLength(2);
      expect(sorted[0].title).toBe('Server Test: Verify Sidebar Update');
      expect(sorted[1].title).toBe('Final Test Update 2025');
      
      // Verify the actual timestamps
      expect(sorted[0].updatedAt.getTime()).toBeGreaterThan(sorted[1].updatedAt.getTime());
    });

    it('should sort threads by updatedAt ASC correctly', () => {
      const sorted = sortThreads([...testThreads], 'updatedAt', 'ASC');
      
      expect(sorted).toHaveLength(2);
      expect(sorted[0].title).toBe('Final Test Update 2025');
      expect(sorted[1].title).toBe('Server Test: Verify Sidebar Update');
      
      // Verify the actual timestamps
      expect(sorted[0].updatedAt.getTime()).toBeLessThan(sorted[1].updatedAt.getTime());
    });

    it('should sort threads by createdAt DESC correctly', () => {
      const sorted = sortThreads([...testThreads], 'createdAt', 'DESC');
      
      expect(sorted).toHaveLength(2);
      expect(sorted[0].title).toBe('Final Test Update 2025');
      expect(sorted[1].title).toBe('Server Test: Verify Sidebar Update');
      
      // Verify the actual timestamps
      expect(sorted[0].createdAt.getTime()).toBeGreaterThan(sorted[1].createdAt.getTime());
    });

    it('should sort threads by createdAt ASC correctly', () => {
      const sorted = sortThreads([...testThreads], 'createdAt', 'ASC');
      
      expect(sorted).toHaveLength(2);
      expect(sorted[0].title).toBe('Server Test: Verify Sidebar Update');
      expect(sorted[1].title).toBe('Final Test Update 2025');
      
      // Verify the actual timestamps
      expect(sorted[0].createdAt.getTime()).toBeLessThan(sorted[1].createdAt.getTime());
    });
  });

  describe('castThreadOrderBy method', () => {
    it('should return createdAt for valid createdAt input', () => {
      expect(castThreadOrderBy('createdAt')).toBe('createdAt');
    });

    it('should return updatedAt for valid updatedAt input', () => {
      expect(castThreadOrderBy('updatedAt')).toBe('updatedAt');
    });

    it('should default to createdAt for invalid input', () => {
      expect(castThreadOrderBy('invalid')).toBe('createdAt');
      expect(castThreadOrderBy(null)).toBe('createdAt');
      expect(castThreadOrderBy(undefined)).toBe('createdAt');
    });
  });

  describe('castThreadSortDirection method', () => {
    it('should return ASC for valid ASC input', () => {
      expect(castThreadSortDirection('ASC')).toBe('ASC');
    });

    it('should return DESC for valid DESC input', () => {
      expect(castThreadSortDirection('DESC')).toBe('DESC');
    });

    it('should default to DESC for invalid input', () => {
      expect(castThreadSortDirection('invalid')).toBe('DESC');
      expect(castThreadSortDirection(null)).toBe('DESC');
      expect(castThreadSortDirection(undefined)).toBe('DESC');
    });
  });

  describe('Bug fix verification', () => {
    it('should fix the specific bug where threads with later updatedAt appear after ones with earlier updatedAt', () => {
      // This test specifically covers the bug reported in issue #7748
      // Before the fix, threads were always sorted by createdAt DESC regardless of parameters
      
      const sorted = sortThreads([...testThreads], 'updatedAt', 'DESC');
      
      // The thread with the later updatedAt (2025-09-11T19:07:24.186Z) should come first
      expect(sorted[0].title).toBe('Server Test: Verify Sidebar Update');
      expect(sorted[0].updatedAt.toISOString()).toBe('2025-09-11T19:07:24.186Z');
      
      // The thread with the earlier updatedAt (2025-09-11T01:04:12.265Z) should come second
      expect(sorted[1].title).toBe('Final Test Update 2025');
      expect(sorted[1].updatedAt.toISOString()).toBe('2025-09-11T01:04:12.265Z');
    });
  });
});
