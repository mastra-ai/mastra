import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { describe, it, expect, vi } from 'vitest';

import { PoolAdapter } from './client';

/**
 * Regression coverage for the missing *client-level* 'error' handlers.
 *
 * pg removes the pool's idle 'error' listener from a client while it is
 * checked out (pg-pool `_acquireClient`) and only re-adds it on release. So a
 * checked-out client whose backend dies between queries (idle-TCP kill by a
 * pooler/NAT, `pg_terminate_backend`, backend restart) emits 'error' on the
 * Client with no listener attached, which Node escalates to an
 * uncaughtException that crashes the host process. PoolAdapter must guard
 * every checkout it hands out (`connect()` and `tx()`).
 */
function makeFakeClient(): PoolClient & { release: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> } {
  const client = new EventEmitter() as unknown as PoolClient & {
    release: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  client.release = vi.fn();
  client.query = vi.fn(async () => ({ rows: [] }) as any);
  return client;
}

describe('PoolAdapter checked-out client error handling', () => {
  it('connect() attaches a client error listener that survives a mid-checkout backend death', async () => {
    const client = makeFakeClient();
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    const checkedOut = await adapter.connect();

    expect(checkedOut.listenerCount('error')).toBe(1);
    // Without a listener this would escalate to an uncaughtException; with the
    // guard it is a no-op and the process survives.
    expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();

    // release() stays transparent: the guard detaches and forwards to the
    // original release, which is restored afterwards.
    checkedOut.release();
    expect(client.release).toHaveBeenCalledOnce();
    expect(checkedOut.listenerCount('error')).toBe(0);
  });

  it('tx() guards the transaction client for the duration of the callback', async () => {
    const client = makeFakeClient();
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const adapter = new PoolAdapter(pool);

    await adapter.tx(async () => {
      // A backend recycle while the transaction client is held must not crash.
      expect(client.listenerCount('error')).toBe(1);
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
    });

    // Released in finally.
    expect(client.release).toHaveBeenCalledOnce();
  });
});
