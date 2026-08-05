import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveClient, DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { LibSQLStore } from './index';

type TestClient = ReturnType<typeof createClient>;

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

  it('honors a custom connectionTimeoutMs', async () => {
    const store = new LibSQLStore({
      id: 'busy-custom',
      url: `file:${path.join(tmpDir, 'custom.db')}`,
      connectionTimeoutMs: 1234,
    });
    try {
      await store.init();

      expect(await readBusyTimeout(getClient(store))).toBe(1234);
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
