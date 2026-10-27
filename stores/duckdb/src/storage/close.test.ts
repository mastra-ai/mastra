import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core';
import { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DuckDBStore } from './index';

describe('DuckDBStore.close()', () => {
  let dir: string;
  let dbPath: string;
  let duck: DuckDBStore | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'duckdb-close-'));
    dbPath = join(dir, 'observability.duckdb');
  });

  afterEach(async () => {
    await duck?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function reopenInAnotherProcess() {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        'import { DuckDBInstance } from "@duckdb/node-api"; const db = await DuckDBInstance.create(process.argv[1]); db.closeSync();',
        dbPath,
      ],
      { cwd: join(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 10_000 },
    );
    expect(result.status, result.stderr || result.error?.message).toBe(0);
  }

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

  // A composed observability domain must release its own connection on close. (#28648)
  it('releases the file lock when the composite store is closed', async () => {
    duck = new DuckDBStore({ path: dbPath });
    const storage = new MastraCompositeStore({ id: 'app', domains: { observability: duck.observability } });
    await storage.init();
    await storage.close();

    reopenInAnotherProcess();
    await expect(duck.close()).resolves.toBeUndefined();
  });

  it('waits for pending observability init before releasing the file lock', async () => {
    duck = new DuckDBStore({ path: dbPath });
    const storage = new MastraCompositeStore({ id: 'app', domains: { observability: duck.observability } });
    const init = storage.init();
    await Promise.resolve(); // Allow composite init to start the observability domain.
    await storage.close();
    await init;

    reopenInAnotherProcess();
    await expect(duck.observability.init()).rejects.toThrow('closed');
    reopenInAnotherProcess();
  });

  it('waits for pending observability init when closing DuckDBStore directly', async () => {
    duck = new DuckDBStore({ path: dbPath });
    const init = duck.observability.init();
    await duck.close();
    await init;

    reopenInAnotherProcess();
  });

  it('does not reopen the file when an observability read follows shutdown', async () => {
    duck = new DuckDBStore({ path: dbPath });
    await duck.observability.init();
    await duck.close();

    await expect(duck.observability.getSpan({ spanId: 'missing' })).rejects.toThrow('closed');
    reopenInAnotherProcess();
  });

  it('does not reopen the file when an observability read races with shutdown', async () => {
    duck = new DuckDBStore({ path: dbPath });
    await duck.observability.init();
    const read = duck.observability.getSpan({ spanId: 'missing' });
    await duck.close();
    await Promise.allSettled([read]);

    reopenInAnotherProcess();
  });

  it('releases the file lock when Mastra shuts down', async () => {
    duck = new DuckDBStore({ path: dbPath });
    const storage = new MastraCompositeStore({ id: 'app', domains: { observability: duck.observability } });
    const mastra = new Mastra({ storage });
    await storage.init();
    await mastra.shutdown();

    reopenInAnotherProcess();
  });
});
