import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageThreadType } from '../memory/types';
import { TABLE_SCHEMAS, TABLE_THREADS } from './constants';
import { InMemoryDB } from './domains/inmemory-db';
import { InMemoryMemory } from './domains/memory/inmemory';
import type { StorageColumn } from './types';
import { mergeSchemaExtensions, extractCustomColumns } from './utils';

describe('Issue #11076 — Custom columns on Mastra tables', () => {
  describe('mergeSchemaExtensions()', () => {
    it('should return base schema unchanged when no extensions provided', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const result = mergeSchemaExtensions(base, undefined);
      expect(result).toBe(base); // same reference
    });

    it('should return base schema unchanged for empty extensions', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const result = mergeSchemaExtensions(base, {});
      expect(result).toBe(base);
    });

    it('should merge custom columns into base schema', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const extensions: Record<string, StorageColumn> = {
        organizationId: { type: 'text', nullable: false },
        tenantId: { type: 'text', nullable: true },
      };
      const result = mergeSchemaExtensions(base, extensions);

      // Has all base columns
      for (const key of Object.keys(base)) {
        expect(result).toHaveProperty(key);
      }
      // Has custom columns
      expect(result).toHaveProperty('organizationId');
      expect(result.organizationId).toEqual({ type: 'text', nullable: false });
      expect(result).toHaveProperty('tenantId');
      expect(result.tenantId).toEqual({ type: 'text', nullable: true });
    });

    it('should throw when custom column name conflicts with built-in column', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const extensions: Record<string, StorageColumn> = {
        id: { type: 'text', nullable: false }, // 'id' is a built-in column
      };
      expect(() => mergeSchemaExtensions(base, extensions)).toThrow(/conflicts with a built-in column/);
    });

    it('should throw when custom column has primaryKey', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const extensions: Record<string, StorageColumn> = {
        myKey: { type: 'text', nullable: false, primaryKey: true },
      };
      expect(() => mergeSchemaExtensions(base, extensions)).toThrow(/cannot be a primary key/);
    });

    it('should throw for invalid column names', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const extensions: Record<string, StorageColumn> = {
        'bad-name': { type: 'text', nullable: true },
      };
      expect(() => mergeSchemaExtensions(base, extensions)).toThrow(/Invalid schema extension column name/);
    });

    it('should allow column names with underscores and numbers', () => {
      const base = TABLE_SCHEMAS[TABLE_THREADS];
      const extensions: Record<string, StorageColumn> = {
        org_id_2: { type: 'text', nullable: true },
        _private: { type: 'integer', nullable: true },
      };
      const result = mergeSchemaExtensions(base, extensions);
      expect(result).toHaveProperty('org_id_2');
      expect(result).toHaveProperty('_private');
    });
  });

  describe('extractCustomColumns()', () => {
    it('should return undefined when no extension column names', () => {
      const row = { id: '1', organizationId: 'org-1' };
      expect(extractCustomColumns(row, [])).toBeUndefined();
    });

    it('should extract custom column values from a row', () => {
      const row = { id: '1', resourceId: 'user-1', organizationId: 'org-1', tenantId: 'tenant-1' };
      const result = extractCustomColumns(row, ['organizationId', 'tenantId']);
      expect(result).toEqual({ organizationId: 'org-1', tenantId: 'tenant-1' });
    });

    it('should skip columns not present in the row', () => {
      const row = { id: '1', organizationId: 'org-1' };
      const result = extractCustomColumns(row, ['organizationId', 'tenantId']);
      expect(result).toEqual({ organizationId: 'org-1' });
    });

    it('should return undefined when no extension columns exist in row', () => {
      const row = { id: '1', resourceId: 'user-1' };
      expect(extractCustomColumns(row, ['organizationId'])).toBeUndefined();
    });
  });

  describe('InMemory adapter with customColumns', () => {
    let db: InMemoryDB;
    let memory: InMemoryMemory;

    beforeEach(() => {
      db = new InMemoryDB();
      memory = new InMemoryMemory({ db });
    });

    it('should save and retrieve a thread with customColumns', async () => {
      const thread: StorageThreadType = {
        id: 'thread-1',
        resourceId: 'user-1',
        title: 'Test Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { foo: 'bar' },
        customColumns: { organizationId: 'org-123' },
      };

      await memory.saveThread({ thread });
      const retrieved = await memory.getThreadById({ threadId: 'thread-1' });

      expect(retrieved).not.toBeNull();
      expect(retrieved!.customColumns).toEqual({ organizationId: 'org-123' });
      expect(retrieved!.metadata).toEqual({ foo: 'bar' });
    });

    it('should update thread customColumns', async () => {
      const thread: StorageThreadType = {
        id: 'thread-2',
        resourceId: 'user-1',
        title: 'Original',
        createdAt: new Date(),
        updatedAt: new Date(),
        customColumns: { organizationId: 'org-1', tenantId: 'tenant-1' },
      };

      await memory.saveThread({ thread });
      const updated = await memory.updateThread({
        id: 'thread-2',
        title: 'Updated',
        metadata: {},
        customColumns: { tenantId: 'tenant-2' },
      });

      expect(updated.customColumns).toEqual({ organizationId: 'org-1', tenantId: 'tenant-2' });
      expect(updated.title).toBe('Updated');
    });

    it('should filter threads by customColumns in listThreads', async () => {
      const threads: StorageThreadType[] = [
        {
          id: 't-1',
          resourceId: 'user-1',
          title: 'Org A Thread 1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          customColumns: { organizationId: 'org-a' },
        },
        {
          id: 't-2',
          resourceId: 'user-1',
          title: 'Org B Thread',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          customColumns: { organizationId: 'org-b' },
        },
        {
          id: 't-3',
          resourceId: 'user-2',
          title: 'Org A Thread 2',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
          customColumns: { organizationId: 'org-a' },
        },
      ];

      for (const t of threads) {
        await memory.saveThread({ thread: t });
      }

      const result = await memory.listThreads({
        filter: { customColumns: { organizationId: 'org-a' } },
      });

      expect(result.threads).toHaveLength(2);
      expect(result.threads.map(t => t.id).sort()).toEqual(['t-1', 't-3']);
    });

    it('should filter threads by customColumns AND resourceId', async () => {
      const threads: StorageThreadType[] = [
        {
          id: 't-1',
          resourceId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          customColumns: { organizationId: 'org-a' },
        },
        {
          id: 't-2',
          resourceId: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          customColumns: { organizationId: 'org-a' },
        },
      ];

      for (const t of threads) {
        await memory.saveThread({ thread: t });
      }

      const result = await memory.listThreads({
        filter: { resourceId: 'user-1', customColumns: { organizationId: 'org-a' } },
      });

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]!.id).toBe('t-1');
    });

    it('should clone thread with customColumns', async () => {
      const thread: StorageThreadType = {
        id: 'source-thread',
        resourceId: 'user-1',
        title: 'Source Thread',
        createdAt: new Date(),
        updatedAt: new Date(),
        customColumns: { organizationId: 'org-123' },
      };

      await memory.saveThread({ thread });
      const result = await memory.cloneThread({
        sourceThreadId: 'source-thread',
        newThreadId: 'cloned-thread',
      });

      expect(result.thread.customColumns).toEqual({ organizationId: 'org-123' });
      expect(result.thread.id).toBe('cloned-thread');
    });

    it('should return threads without customColumns when none set', async () => {
      const thread: StorageThreadType = {
        id: 'plain-thread',
        resourceId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await memory.saveThread({ thread });
      const retrieved = await memory.getThreadById({ threadId: 'plain-thread' });

      expect(retrieved).not.toBeNull();
      expect(retrieved!.customColumns).toBeUndefined();
    });
  });
});
