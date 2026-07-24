import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { describe, it, expect, vi } from 'vitest';

import { attachClientErrorHandler, connectWithClientErrorHandler } from './client-error-guard';

/**
 * Minimal PoolClient stand-in. Real pg PoolClients are EventEmitters whose
 * `release` is (re)assigned by the pool on every checkout — that's the exact
 * surface these helpers touch, so an EventEmitter with a `release` spy models
 * it faithfully without a live database.
 */
function makeFakeClient(): PoolClient & { release: ReturnType<typeof vi.fn> } {
  const client = new EventEmitter() as unknown as PoolClient & { release: ReturnType<typeof vi.fn> };
  client.release = vi.fn();
  return client;
}

function makeFakePool(client: PoolClient): Pool {
  return { connect: vi.fn(async () => client) } as unknown as Pool;
}

describe('attachClientErrorHandler', () => {
  it('attaches a single error listener and swallows client errors', () => {
    const client = makeFakeClient();

    expect(client.listenerCount('error')).toBe(0);
    attachClientErrorHandler(client);
    expect(client.listenerCount('error')).toBe(1);

    // Without a listener this would escalate to an uncaughtException and crash
    // the host process; with our handler it is a no-op.
    expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
  });

  it('is idempotent: re-attaching to the same client does not add a second listener', () => {
    const client = makeFakeClient();

    attachClientErrorHandler(client);
    attachClientErrorHandler(client);
    attachClientErrorHandler(client);

    // Pooled clients are reused across checkouts; a single persistent listener
    // covers every checkout without leaking one listener per checkout.
    expect(client.listenerCount('error')).toBe(1);
  });

  it('detach() removes the listener and allows a fresh re-attach', () => {
    const client = makeFakeClient();
    const detach = attachClientErrorHandler(client);
    expect(client.listenerCount('error')).toBe(1);

    detach();
    expect(client.listenerCount('error')).toBe(0);
    // Idempotent: a second detach is a no-op.
    detach();
    expect(client.listenerCount('error')).toBe(0);

    // After detaching, the client can be guarded again.
    attachClientErrorHandler(client);
    expect(client.listenerCount('error')).toBe(1);
  });

  it('routes the error to the provided logger', () => {
    const client = makeFakeClient();
    const warn = vi.fn();
    attachClientErrorHandler(client, { warn });

    client.emit('error', new Error('boom'));

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![1]).toMatchObject({ err: 'boom' });
  });

  it('no-ops for clients that are not EventEmitters', () => {
    // Some call sites (and test doubles) pass a plain object client without
    // `on`/`removeListener`; the guard must not throw for them.
    const client = { query: vi.fn(), release: vi.fn() } as unknown as PoolClient;
    let detach: () => void;
    expect(() => {
      detach = attachClientErrorHandler(client);
    }).not.toThrow();
    expect(() => detach()).not.toThrow();
  });
});

describe('connectWithClientErrorHandler', () => {
  it('checks out a client with an error listener attached', async () => {
    const client = makeFakeClient();
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);

    expect(checkedOut).toBe(client);
    expect(client.listenerCount('error')).toBe(1);
    expect(() => client.emit('error', new Error('backend died mid-checkout'))).not.toThrow();
  });

  it('does not replace the client release function', async () => {
    // The guard must be transparent to callers' `finally { client.release() }`
    // and must not clobber `release` (pooled clients / test doubles reuse it).
    const client = makeFakeClient();
    const originalRelease = client.release;
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);

    expect(checkedOut.release).toBe(originalRelease);
    checkedOut.release();
    expect(originalRelease).toHaveBeenCalledOnce();
    // The listener persists across release (it is attached once per client).
    expect(client.listenerCount('error')).toBe(1);
  });

  it('is idempotent across repeated checkouts of the same pooled client', async () => {
    const client = makeFakeClient();
    const pool = makeFakePool(client);

    await connectWithClientErrorHandler(pool);
    await connectWithClientErrorHandler(pool);

    expect(client.listenerCount('error')).toBe(1);
  });
});
