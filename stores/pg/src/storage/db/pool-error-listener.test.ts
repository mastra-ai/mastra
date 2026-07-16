import { describe, it, expect, vi, afterEach } from 'vitest';

import type { PoolAdapter } from '..';
import { resolvePgConfig } from '.';

// Points at a dead port — this test needs no live database. The pool only
// opens sockets on first checkout.
const DEAD_CONNECTION_STRING = 'postgresql://user:pass@127.0.0.1:1/db';

// Regression coverage for the missing pool 'error' listener: pg emits
// 'error' on the pool when an idle client's connection drops; with no
// listener attached Node escalates it to an uncaughtException and crashes
// the process ("Error: read ECONNRESET" at TCP.onStreamRead).
describe('resolvePgConfig pool error listener', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches an error listener to pools it creates', async () => {
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
