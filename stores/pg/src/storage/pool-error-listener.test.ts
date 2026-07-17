import pg from 'pg';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { PostgresStore, PostgresStoreVNext } from '.';

// Points at a dead port — these tests need no live database. The pool only
// opens sockets on first checkout.
const DEAD_CONNECTION_STRING = 'postgresql://user:pass@127.0.0.1:1/db';

// Regression coverage for the missing pool 'error' listeners: pg emits
// 'error' on the pool when an idle client's connection drops; with no
// listener attached Node escalates it to an uncaughtException and crashes
// the process ("Error: read ECONNRESET" at TCP.onStreamRead).
describe('PostgresStore pool error listeners', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches an error listener to pools it creates', async () => {
    const store = new PostgresStore({
      id: 'pool-error-test',
      connectionString: DEAD_CONNECTION_STRING,
    });

    // createPool is the single construction path for store-owned pools.
    const pool = (store as unknown as { createPool(config: unknown): pg.Pool }).createPool({
      connectionString: DEAD_CONNECTION_STRING,
    });

    try {
      expect(pool.listenerCount('error')).toBe(1);
      expect(() => pool.emit('error', new Error('idle client dropped'))).not.toThrow();
    } finally {
      await pool.end();
      await store.close();
    }
  });

  it('leaves user-provided pools untouched', async () => {
    const userPool = new pg.Pool({ connectionString: DEAD_CONNECTION_STRING });
    const store = new PostgresStore({ id: 'pool-error-test', pool: userPool });

    try {
      // Error handling on a user-owned pool stays the user's, mirroring close().
      expect(userPool.listenerCount('error')).toBe(0);
    } finally {
      await store.close();
      await userPool.end();
    }
  });

  it('PostgresStoreVNext attaches an error listener to the observability pool it creates', async () => {
    const userPool = new pg.Pool({ connectionString: DEAD_CONNECTION_STRING });
    // The observability pool lives in a native private field, so track
    // listener registration through the shared Pool prototype instead.
    const onSpy = vi.spyOn(pg.Pool.prototype, 'on');

    const store = new PostgresStoreVNext({
      id: 'pool-error-test',
      pool: userPool,
      observability: { connectionString: 'postgresql://user:pass@127.0.0.1:2/db' },
    });

    try {
      const errorRegistrations = onSpy.mock.calls
        .map((call, i) => ({ event: call[0], instance: onSpy.mock.instances[i] as pg.Pool }))
        .filter(({ event }) => event === 'error');

      // Exactly one 'error' listener was attached during construction — on the
      // store-created observability pool, not the caller-supplied primary pool.
      expect(errorRegistrations).toHaveLength(1);
      const obsPool = errorRegistrations[0]!.instance;
      expect(obsPool).not.toBe(userPool);
      expect(obsPool.listenerCount('error')).toBe(1);
      expect(() => obsPool.emit('error', new Error('idle client dropped'))).not.toThrow();
      expect(userPool.listenerCount('error')).toBe(0);
    } finally {
      await store.close();
      await userPool.end();
    }
  });
});
