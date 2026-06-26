import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DuckDBStore } from './index';

describe('DuckDBStore.close()', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'duckdb-close-'));
    dbPath = join(dir, 'observability.duckdb');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('releases the native file lock so the same file can be reopened', async () => {
    const first = new DuckDBStore({ id: 'close-first', path: dbPath });
    await first.init();
    await first.close();

    // If close() did not release the native DuckDB lock, this would throw
    // "Conflicting lock is held" -- the exact hot-reload failure we fixed.
    const second = new DuckDBStore({ id: 'close-second', path: dbPath });
    await second.init();
    await second.close();
  });

  it('is idempotent -- a second close() is a no-op', async () => {
    const store = new DuckDBStore({ id: 'close-idempotent', path: dbPath });
    await store.init();

    await store.close();
    await expect(store.close()).resolves.toBeUndefined();
  });
});
