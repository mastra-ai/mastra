import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLVector } from './index';

type TestClient = ReturnType<typeof createClient>;

const getClient = (vector: LibSQLVector): TestClient => (vector as unknown as { turso: TestClient }).turso;

const executedSqlFrom = (spy: ReturnType<typeof vi.spyOn>): string[] =>
  (spy.mock.calls as unknown as unknown[][]).map(call => {
    const arg = call[0];
    return typeof arg === 'string' ? arg : (arg as { sql: string }).sql;
  });

describe('LibSQLVector.close()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-vector-close-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('checkpoints/truncates the WAL and closes the client for local file DBs', async () => {
    const dbPath = path.join(tmpDir, 'vectors.db');
    const vector = new LibSQLVector({ id: 'close-local', url: `file:${dbPath}` });
    await vector.createIndex({ indexName: 'close_test', dimension: 4 });

    const client = getClient(vector);
    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await vector.close();

    const executedSql = executedSqlFrom(executeSpy);
    expect(executedSql).toContain('PRAGMA wal_checkpoint(TRUNCATE);');
    expect(executedSql).toContain('PRAGMA journal_mode=DELETE;');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(client.closed).toBe(true);
  });

  it('is idempotent — a second close() is a no-op', async () => {
    const dbPath = path.join(tmpDir, 'vectors.db');
    const vector = new LibSQLVector({ id: 'close-idempotent', url: `file:${dbPath}` });
    await vector.createIndex({ indexName: 'close_test', dimension: 4 });

    const client = getClient(vector);

    await vector.close();

    const executeSpy = vi.spyOn(client, 'execute');
    const closeSpy = vi.spyOn(client, 'close');

    await expect(vector.close()).resolves.toBeUndefined();

    expect(executeSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
