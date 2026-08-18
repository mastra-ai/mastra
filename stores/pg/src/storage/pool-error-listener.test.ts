import { EventEmitter } from 'node:events';

import pg from 'pg';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { PgFactoryStorage } from './factory-storage';
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

  it('PgFactoryStorage attaches an error listener to pools it creates', async () => {
    const storage = new PgFactoryStorage({ connectionString: DEAD_CONNECTION_STRING });
    const db = storage.authDatabase();
    if (db.dialect !== 'postgres') throw new Error('expected a postgres auth database');
    const pool = db.pool as pg.Pool;

    try {
      expect(pool.listenerCount('error')).toBe(1);
      expect(() => pool.emit('error', new Error('idle client dropped'))).not.toThrow();
    } finally {
      await storage.close();
    }
  });

  it('PgFactoryStorage does not add a listener to a wrapped store pool', async () => {
    const userPool = new pg.Pool({ connectionString: DEAD_CONNECTION_STRING });
    const store = new PostgresStore({ id: 'pool-error-test', pool: userPool });
    const storage = new PgFactoryStorage({ store });

    try {
      // The wrapped store's pool keeps the caller's listeners, mirroring close().
      expect(userPool.listenerCount('error')).toBe(0);
    } finally {
      await storage.close();
      await userPool.end();
    }
  });

  // The pool listener above only covers *idle* clients. pg takes its own
  // listener off a client for the duration of a checkout, so a connection that
  // drops mid-transaction reached an emitter with nothing listening and Node
  // escalated it to an uncaughtException ("Connection terminated unexpectedly"
  // at pg/lib/client.js) that killed the API process.
  it('PgFactoryStorage keeps a client error fatal-free while it is checked out', async () => {
    const warn = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(warn);
    const storage = new PgFactoryStorage({ connectionString: DEAD_CONNECTION_STRING });
    const db = storage.authDatabase();
    if (db.dialect !== 'postgres') throw new Error('expected a postgres auth database');
    const pool = db.pool as pg.Pool;

    try {
      // Stand in for a real backend connection: the pool announces every client
      // it establishes via 'connect', which is where the guard hooks in.
      const client = new EventEmitter();
      pool.emit('connect', client as unknown as pg.PoolClient);

      // A borrowed client that loses its connection must stay reportable rather
      // than take the process down. EventEmitter throws on an unhandled 'error'.
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Connection terminated unexpectedly'));
    } finally {
      await storage.close();
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
