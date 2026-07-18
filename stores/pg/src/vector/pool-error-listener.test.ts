import { describe, it, expect } from 'vitest';

import { PgVector } from '.';

// Points at a dead port — this test needs no live database. The pool only
// opens sockets on first checkout, and PgVector's cache warmup failure is
// swallowed internally.
const DEAD_CONNECTION_STRING = 'postgresql://user:pass@127.0.0.1:1/db';

// Regression coverage for the missing pool 'error' listener: pg emits
// 'error' on the pool when an idle client's connection drops; with no
// listener attached Node escalates it to an uncaughtException and crashes
// the process ("Error: read ECONNRESET" at TCP.onStreamRead).
describe('PgVector pool error listener', () => {
  it('attaches an error listener to the pool it creates', async () => {
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
});
