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

  it('checkpoints/truncates the WAL and closes the client for local file DBs', async () => {
    const dbPath = path.join(tmpDir, 'mastra.db');
    const store = new LibSQLStore({ id: 'close-local', url: `file:${dbPath}` });
    await store.init();

    const client = getClient(store);
    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await store.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).toContain('PRAGMA journal_mode=DELETE;');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(client.closed).toBe(true);
  });

  it('keeps DELETE-mode databases out of the WAL cleanup path', async () => {
    const dbPath = path.join(tmpDir, 'delete-mode.db');
    const store = new LibSQLStore({ id: 'close-delete', url: `file:${dbPath}`, journalMode: 'delete' });
    await store.init();

    const client = getClient(store);
    const mode = await client.execute('PRAGMA journal_mode;');
    expect(Object.values(mode.rows[0] ?? {})[0]).toBe('delete');

    const executeSpy = vi.spyOn(client, 'execute');
    await store.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).not.toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).not.toContain('PRAGMA journal_mode=DELETE;');
    expect(client.closed).toBe(true);
  });

  it('fails initialization rather than silently keeping WAL when DELETE mode cannot be applied', async () => {
    const dbPath = path.join(tmpDir, 'locked-wal.db');
    const walStore = new LibSQLStore({ id: 'wal-owner', url: `file:${dbPath}` });
    await walStore.init();
    const deleteStore = new LibSQLStore({ id: 'delete-owner', url: `file:${dbPath}`, journalMode: 'delete' });

    try {
      await expect(deleteStore.init()).rejects.toThrow();
    } finally {
      await deleteStore.close().catch(() => undefined);
      await walStore.close();
    }
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

  it('runs WAL cleanup for an injected client that points at a local file', async () => {
    const dbPath = path.join(tmpDir, 'injected.db');
    const client = createClient({ url: `file:${dbPath}` });
    const store = new LibSQLStore({ id: 'close-injected-local', client });
    await store.init();

    expect(client.protocol).toBe('file');

    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await store.close();

    expect(executedSqlFrom(executeSpy)).toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('skips WAL pragmas for non-file (remote) clients', async () => {
    const client = createClient({ url: `file:${path.join(tmpDir, 'remote.db')}` });
    // Pretend this is a remote connection without touching the underlying file logic.
    Object.defineProperty(client, 'protocol', { value: 'https', configurable: true });

    const store = new LibSQLStore({ id: 'close-remote', client });
    await store.init();

    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await store.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).not.toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).not.toContain('PRAGMA journal_mode=DELETE;');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('still closes the client and warns when WAL checkpoint fails', async () => {
    const dbPath = path.join(tmpDir, 'wal-fail.db');
    const store = new LibSQLStore({ id: 'close-wal-fail', url: `file:${dbPath}` });
    await store.init();

    const client = getClient(store);
    vi.spyOn(client, 'execute').mockRejectedValue(new Error('boom'));
    const closeSpy = vi.spyOn(client, 'close');
    const warnSpy = vi.spyOn((store as unknown as { logger: { warn: (...args: unknown[]) => void } }).logger, 'warn');

    await expect(store.close()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('removes WAL sidecar files so the storage dir can be deleted', async () => {
    const dbPath = path.join(tmpDir, 'sidecars.db');
    const store = new LibSQLStore({ id: 'close-sidecars', url: `file:${dbPath}` });
    await store.init();

    // Force some writes so the WAL sidecar files exist.
    const client = getClient(store);
    await client.execute('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY);');
    await client.execute('INSERT INTO t (id) VALUES (1);');

    await store.close();

    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
  });
});
