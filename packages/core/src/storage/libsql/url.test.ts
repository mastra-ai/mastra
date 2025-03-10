import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TABLE_WORKFLOW_SNAPSHOT } from '../constants';
import { LibSQLStore } from './index';

interface WorkflowSnapshot {
  workflow_name: string;
  run_id: string;
  snapshot: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

describe('LibSQLStore URL rewriting', () => {
  let tmpDir: string;
  let originalCwd: string;
  let parentDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'mastra-test-libsql-store-url');
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir);
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    parentDir = join(tmpDir, '..');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Database file creation', () => {
    it('should create db file in project root when running from project root', async () => {
      const store = new LibSQLStore({ config: { url: 'file:test.db' } });
      await store.init();
      expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
      expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
      expect(existsSync(join(tmpDir, '.mastra', 'output', 'test.db'))).toBe(false);
      expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
    });

    it('should create db file in project root when running from .mastra/output', async () => {
      const mastraOutputDir = join(tmpDir, '.mastra', 'output');
      mkdirSync(mastraOutputDir, { recursive: true });
      process.chdir(mastraOutputDir);
      const store = new LibSQLStore({ config: { url: 'file:test.db' } });
      await store.init();
      expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
      expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
      expect(existsSync(join(tmpDir, '.mastra', 'output', 'test.db'))).toBe(false);
      expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
    });

    it('should create db file in .mastra directory when explicitly specified', async () => {
      const mastraDir = join(tmpDir, '.mastra');
      mkdirSync(mastraDir, { recursive: true });
      const store = new LibSQLStore({ config: { url: 'file:.mastra/test.db' } });
      await store.init();
      expect(existsSync(join(tmpDir, 'test.db'))).toBe(false);
      expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(true);
      expect(existsSync(join(tmpDir, '.mastra', 'output', 'test.db'))).toBe(false);
      expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
    });

    it('should create db file in .mastra directory when explicitly specified and running from .mastra/output', async () => {
      const mastraDir = join(tmpDir, '.mastra');
      const mastraOutputDir = join(mastraDir, 'output');
      mkdirSync(mastraOutputDir, { recursive: true });
      process.chdir(mastraOutputDir);
      const store = new LibSQLStore({ config: { url: 'file:.mastra/test.db' } });
      await store.init();
      expect(existsSync(join(tmpDir, 'test.db'))).toBe(false);
      expect(existsSync(join(mastraDir, 'test.db'))).toBe(true);
      expect(existsSync(join(mastraOutputDir, 'test.db'))).toBe(false);
      expect(existsSync(join(parentDir, 'test.db'))).toBe(false);
    });
  });

  describe('Database consistency across working directories', () => {
    it('should maintain single database file and data consistency when switching working directories', async () => {
      // First, create and write to the database from project root
      const store1 = new LibSQLStore({ config: { url: 'file:test.db' } });
      await store1.init();

      // Write a test record
      await store1.batchInsert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        records: [
          {
            workflow_name: 'test-workflow',
            run_id: 'test-1',
            snapshot: JSON.stringify({ test: 'data1' }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      // Switch to .mastra/output and write another record
      const mastraOutputDir = join(tmpDir, '.mastra', 'output');
      mkdirSync(mastraOutputDir, { recursive: true });
      process.chdir(mastraOutputDir);

      const store2 = new LibSQLStore({ config: { url: 'file:test.db' } });
      await store2.init();

      await store2.batchInsert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        records: [
          {
            workflow_name: 'test-workflow',
            run_id: 'test-2',
            snapshot: JSON.stringify({ test: 'data2' }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      // Verify database file exists only in project root
      expect(existsSync(join(tmpDir, 'test.db'))).toBe(true);
      expect(existsSync(join(tmpDir, '.mastra', 'test.db'))).toBe(false);
      expect(existsSync(join(tmpDir, '.mastra', 'output', 'test.db'))).toBe(false);
      expect(existsSync(join(parentDir, 'test.db'))).toBe(false);

      // Query the database to verify both records exist
      const record1 = await store2.load<WorkflowSnapshot>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: 'test-workflow', run_id: 'test-1' },
      });
      expect(record1).toBeTruthy();
      if (record1) {
        expect(record1.workflow_name).toBe('test-workflow');
        expect(record1.run_id).toBe('test-1');
        expect(record1.snapshot).toEqual({ test: 'data1' });
      }

      const record2 = await store2.load<WorkflowSnapshot>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: 'test-workflow', run_id: 'test-2' },
      });
      expect(record2).toBeTruthy();
      if (record2) {
        expect(record2.workflow_name).toBe('test-workflow');
        expect(record2.run_id).toBe('test-2');
        expect(record2.snapshot).toEqual({ test: 'data2' });
      }
    });
  });
});

