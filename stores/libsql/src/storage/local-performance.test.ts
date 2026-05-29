import { createClient } from '@libsql/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

const mockCreateClient = vi.mocked(createClient);

type ExecutedStatement = { sql: string; kind: 'execute' | 'batch' };

vi.mock('@libsql/client', () => ({
  createClient: vi.fn(),
}));

function createMockClient() {
  const statements: ExecutedStatement[] = [];
  const client = {
    execute: vi.fn(async (statement: string | { sql: string; args?: unknown[] }) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      statements.push({ sql, kind: 'execute' });

      if (/PRAGMA\s+table_info/i.test(sql)) {
        return { rows: [], rowsAffected: 0 };
      }
      if (/duplicate_count/i.test(sql)) {
        return { rows: [{ duplicate_count: 0 }], rowsAffected: 0 };
      }
      if (/sqlite_master/i.test(sql)) {
        return { rows: [], rowsAffected: 0 };
      }
      return { rows: [], rowsAffected: 0 };
    }),
    batch: vi.fn(async (batchStatements: Array<{ sql: string; args?: unknown[] }>) => {
      for (const statement of batchStatements) {
        statements.push({ sql: statement.sql, kind: 'batch' });
      }
      return [];
    }),
  };

  return { client, statements };
}

function sqls(statements: ExecutedStatement[]) {
  return statements.map(statement => statement.sql.replace(/\s+/g, ' ').trim());
}

const storeLevelPragmas = [
  'PRAGMA journal_mode=WAL;',
  'PRAGMA busy_timeout=5000;',
  'PRAGMA synchronous=NORMAL;',
  'PRAGMA temp_store=MEMORY;',
  'PRAGMA cache_size=-16000;',
  'PRAGMA mmap_size=134217728;',
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LibSQLStore local performance initialization', () => {
  it('applies safe local PRAGMAs before local file DB schema initialization', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({ id: 'local-file', url: 'file:local-performance.db' });
    await store.init();

    const executedSql = sqls(statements);
    const firstCreateTable = executedSql.findIndex(sql => /^CREATE TABLE/i.test(sql));
    expect(firstCreateTable).toBeGreaterThan(-1);

    const expectedPragmas = [
      'PRAGMA journal_mode=WAL;',
      'PRAGMA busy_timeout=5000;',
      'PRAGMA synchronous=NORMAL;',
      'PRAGMA temp_store=MEMORY;',
      'PRAGMA cache_size=-16000;',
      'PRAGMA mmap_size=134217728;',
    ];

    for (const pragma of expectedPragmas) {
      const index = executedSql.indexOf(pragma);
      expect(index, `${pragma} should execute`).toBeGreaterThan(-1);
      expect(index, `${pragma} should execute before DDL`).toBeLessThan(firstCreateTable);
    }
    expect(executedSql).not.toContain('PRAGMA synchronous=OFF;');
  });

  it('does not apply store-level local PRAGMAs for remote URLs', () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    new LibSQLStore({ id: 'remote', url: 'libsql://example.turso.io', authToken: 'test-token' });

    const executedSql = sqls(statements);
    expect(executedSql.filter(sql => storeLevelPragmas.includes(sql))).toEqual([]);
  });

  it('never applies unsafe synchronous mode', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({ id: 'local-file-safe-only', url: 'file:local-performance-safe-only.db' });
    await store.init();

    const executedSql = sqls(statements);
    expect(executedSql).toContain('PRAGMA synchronous=NORMAL;');
    expect(executedSql).not.toContain('PRAGMA synchronous=OFF;');
  });

  it('allows local cache and mmap PRAGMAs to be increased', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({
      id: 'local-file-custom-pragmas',
      url: 'file:local-performance-custom-pragmas.db',
      localPragmas: {
        cacheSize: -128000,
        mmapSize: 1073741824,
      },
    });
    await store.init();

    const executedSql = sqls(statements);
    expect(executedSql).toContain('PRAGMA cache_size=-128000;');
    expect(executedSql).toContain('PRAGMA mmap_size=1073741824;');
  });

  it('creates message indexes for startup history reads', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({
      id: 'local-file-message-indexes',
      url: 'file:local-performance-message-indexes.db',
    });
    await store.init();

    const executedSql = sqls(statements);
    expect(executedSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON mastra_messages (thread_id, "createdAt")',
    );
    expect(executedSql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_messages_thread_resource_created_at ON mastra_messages (thread_id, "resourceId", "createdAt")',
    );
  });

  it('caches local file DB init after success', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({ id: 'local-file-cache', url: 'file:local-performance-cache.db' });
    await store.init();
    await store.init();

    const createTableCount = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;
    expect(createTableCount).toBeGreaterThan(0);

    await store.init();
    const createTableCountAfterThirdInit = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;
    expect(createTableCountAfterThirdInit).toBe(createTableCount);
  });

  it('does not cache in-memory DB init', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({ id: 'local-memory', url: 'file::memory:' });
    await store.init();
    const firstCreateTableCount = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;

    await store.init();
    const secondCreateTableCount = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;

    expect(firstCreateTableCount).toBeGreaterThan(0);
    expect(secondCreateTableCount).toBeGreaterThan(firstCreateTableCount);
  });

  it('coalesces concurrent local file DB init', async () => {
    const { client, statements } = createMockClient();
    mockCreateClient.mockReturnValueOnce(client as any);

    const store = new LibSQLStore({ id: 'local-file-concurrent', url: 'file:local-performance-concurrent.db' });
    await Promise.all([store.init(), store.init(), store.init()]);

    const createTableCount = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;

    await store.init();
    const createTableCountAfterCachedInit = sqls(statements).filter(sql => /^CREATE TABLE/i.test(sql)).length;
    expect(createTableCountAfterCachedInit).toBe(createTableCount);
  });
});
