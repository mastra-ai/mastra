import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveClient, DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { LibSQLStore } from './index';

type TestClient = ReturnType<typeof resolveClient>;

const getClient = (store: LibSQLStore): TestClient => (store as unknown as { client: TestClient }).client;

const readBusyTimeout = async (client: TestClient): Promise<number> => {
  const rs = await client.execute('PRAGMA busy_timeout');
  return Number(rs.rows[0]!['timeout']);
};

describe('LibSQL busy_timeout configuration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-busy-timeout-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies the default busy_timeout to a local file store', async () => {
    const store = new LibSQLStore({ id: 'busy-default', url: `file:${path.join(tmpDir, 'default.db')}` });
    try {
      await store.init();

      expect(await readBusyTimeout(getClient(store))).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
    } finally {
      await store.close();
    }
  });

  it('does not override a custom busy_timeout when the workflows domain initializes', async () => {
    const client = resolveClient({
      url: `file:${path.join(tmpDir, 'custom.db')}`,
      connectionTimeoutMs: 1234,
    });
    const execute = vi.spyOn(client, 'execute');
    const store = new LibSQLStore({ id: 'busy-custom', client, connectionTimeoutMs: 1234 });

    try {
      await store.init();
      await store.getStore('workflows');

      await expect
        .poll(() => execute.mock.calls.some(([statement]) => String(statement).includes('synchronous')))
        .toBe(true);
      expect(execute.mock.calls.map(([statement]) => String(statement))).not.toContain('PRAGMA busy_timeout = 10000;');
      expect(await readBusyTimeout(client)).toBe(1234);
    } finally {
      await store.close();
    }
  });

  it('keeps the busy_timeout after a transaction() opens a new connection (libsql-client-ts#288)', async () => {
    const client = resolveClient({ url: `file:${path.join(tmpDir, 'txn.db')}`, connectionTimeoutMs: 4321 });

    try {
      const txn = await client.transaction('write');
      await txn.execute('CREATE TABLE t (a)');
      await txn.commit();

      // transaction() hands the client's connection to the transaction and lazily
      // opens a new one; the timeout must apply to that new connection too.
      expect(await readBusyTimeout(client)).toBe(4321);
    } finally {
      client.close();
    }
  });

  it('resolveClient defaults the busy_timeout for local urls', async () => {
    const client = resolveClient({ url: `file:${path.join(tmpDir, 'resolve.db')}` });

    try {
      expect(await readBusyTimeout(client)).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
    } finally {
      client.close();
    }
  });
});
