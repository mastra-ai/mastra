import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

type TestClient = ReturnType<typeof createClient>;

const getClient = (store: LibSQLStore): TestClient => (store as unknown as { client: TestClient }).client;

const executedSqlFrom = (spy: ReturnType<typeof vi.spyOn>): string[] =>
  (spy.mock.calls as unknown as unknown[][]).map(call => {
    const arg = call[0];
    return typeof arg === 'string' ? arg : (arg as { sql: string }).sql;
  });

describe('LibSQLStore.close()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-close-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('closes the client without changing local database state', async () => {
    const dbPath = path.join(tmpDir, 'mastra.db');
    const store = new LibSQLStore({ id: 'close-local', url: `file:${dbPath}` });
    await store.init();

    const client = getClient(store);
    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await store.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).not.toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).not.toContain('PRAGMA journal_mode=DELETE;');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(client.closed).toBe(true);
  });

  it('is idempotent — a second close() is a no-op', async () => {
    const dbPath = path.join(tmpDir, 'mastra.db');
    const store = new LibSQLStore({ id: 'close-idempotent', url: `file:${dbPath}` });
    await store.init();

    const client = getClient(store);

    await store.close();

    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await expect(store.close()).resolves.toBeUndefined();

    expect(executeSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('does not change WAL mode or interrupt another store sharing the database', async () => {
    const dbPath = path.join(tmpDir, 'shared.db');
    const storeA = new LibSQLStore({ id: 'close-shared-a', url: `file:${dbPath}` });
    const storeB = new LibSQLStore({ id: 'close-shared-b', url: `file:${dbPath}` });
    await storeA.init();
    await storeB.init();

    const clientB = getClient(storeB);

    try {
      await clientB.execute('CREATE TABLE close_regression (id INTEGER PRIMARY KEY, value TEXT NOT NULL);');
      await clientB.execute("INSERT INTO close_regression (id, value) VALUES (1, 'before-close');");

      await storeA.close();

      const journalMode = await clientB.execute('PRAGMA journal_mode;');
      expect(journalMode.rows[0]?.journal_mode).toBe('wal');

      await clientB.execute("INSERT INTO close_regression (id, value) VALUES (2, 'after-close');");
      const rows = await clientB.execute('SELECT value FROM close_regression ORDER BY id;');
      expect(rows.rows.map(row => row.value)).toEqual(['before-close', 'after-close']);
    } finally {
      await storeA.close();
      await storeB.close();
    }
  });

  it('closes injected local clients without WAL cleanup', async () => {
    const dbPath = path.join(tmpDir, 'injected.db');
    const client = createClient({ url: `file:${dbPath}` });
    const store = new LibSQLStore({ id: 'close-injected-local', client });
    await store.init();

    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await store.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).not.toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).not.toContain('PRAGMA journal_mode=DELETE;');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
