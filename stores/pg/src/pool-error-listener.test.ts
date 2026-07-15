import pg from 'pg';
import { describe, it, expect, vi, afterEach } from 'vitest';

import type { PoolAdapter } from './storage';
import { PostgresStore } from './storage';
import { resolvePgConfig } from './storage/db';
import { PgVector } from './vector';

// Points at a dead port — none of these tests need a live database. The pool
// only opens sockets on first checkout, and PgVector's cache warmup failure
// is swallowed internally.
const DEAD_CONNECTION_STRING = 'postgresql://user:pass@127.0.0.1:1/db';

// Regression coverage for the missing pool 'error' listeners: pg emits
// 'error' on the pool when an idle client's connection drops; with no
// listener attached Node escalates it to an uncaughtException and crashes
// the process ("Error: read ECONNRESET" at TCP.onStreamRead).
describe('pool error listeners', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PgVector attaches an error listener to the pool it creates', async () => {
    const vector = new PgVector({
      id: 'pool-error-test',
      connectionString: DEAD_CONNECTION_STRING,
    });

    try {
      expect(vector.pool.listenerCount('error')).toBe(1);
      // With no listener this emit would throw (EventEmitter 'error' contract).
      expect(() => vector.pool.emit('error', new Error('idle client dropped'))).not.toThrow();
    } finally {
      await vector.disconnect();
    }
  });

  it('PostgresStore attaches an error listener to pools it creates', async () => {
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

  it('PostgresStore leaves user-provided pools untouched', async () => {
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

  it('resolvePgConfig attaches an error listener to pools it creates', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = resolvePgConfig({ connectionString: DEAD_CONNECTION_STRING });
    const pool = (client as PoolAdapter).$pool;

    try {
      expect(pool.listenerCount('error')).toBe(1);
      expect(() => pool.emit('error', new Error('idle client dropped'))).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      await pool.end();
    }
  });
});
