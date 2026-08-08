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

  it('does not stack a second listener when re-attached within the same checkout', () => {
    const client = makeFakeClient();

    attachClientErrorHandler(client);
    attachClientErrorHandler(client);
    attachClientErrorHandler(client);

    // A client is only checked out once at a time; repeated attaches before a
    // release must not stack listeners.
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

  it('swallows logger failures', () => {
    const client = makeFakeClient();
    attachClientErrorHandler(client, {
      warn: () => {
        throw new Error('logger failed');
      },
    });

    expect(() => client.emit('error', new Error('backend died'))).not.toThrow();
  });

  it('swallows error stringification failures', () => {
    const client = makeFakeClient();
    const unprintableError = {
      toString: () => {
        throw new Error('stringification failed');
      },
    };
    attachClientErrorHandler(client);

    expect(() => client.emit('error', unprintableError)).not.toThrow();
  });

  it('no-ops for clients without a removable event listener', () => {
    // Some call sites (and test doubles) lack `on` or `removeListener`; the
    // guard must not attach a listener it cannot subsequently detach.
    const on = vi.fn();
    const client = { on, query: vi.fn(), release: vi.fn() } as unknown as PoolClient;

    const detach = attachClientErrorHandler(client);

    expect(on).not.toHaveBeenCalled();
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

  it('detaches on release: forwards to the original release, then restores it', async () => {
    // The guard scopes itself to the checkout: it wraps the checkout-specific
    // release so `finally { client.release(err?) }` still works, forwards the
    // caller's arguments to pg-pool's release, removes the listener, and
    // restores the original release so the client is left untouched afterwards.
    const client = makeFakeClient();
    const originalRelease = client.release;
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);
    expect(client.listenerCount('error')).toBe(1);

    const releaseError = new Error('client is broken');
    checkedOut.release(releaseError);

    expect(originalRelease).toHaveBeenCalledOnce();
    expect(originalRelease).toHaveBeenCalledWith(releaseError);
    // Listener removed and original release restored (no permanent mutation).
    expect(client.listenerCount('error')).toBe(0);
    expect(checkedOut.release).toBe(originalRelease);
  });

  it('preserves double-release semantics after detaching', async () => {
    const client = makeFakeClient();
    const originalRelease = client.release;
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);
    checkedOut.release();
    // A second release is forwarded straight to pg-pool's release, which owns
    // the double-release handling — the guard does not swallow it.
    checkedOut.release();

    expect(originalRelease).toHaveBeenCalledTimes(2);
  });

  it('re-guards a reused pooled client on its next checkout with that checkout logger', async () => {
    const client = makeFakeClient();
    const pool = makeFakePool(client);

    const firstWarn = vi.fn();
    const first = await connectWithClientErrorHandler(pool, { warn: firstWarn });
    first.release();

    // After release the client is bare again — no leftover listener.
    expect(client.listenerCount('error')).toBe(0);

    const secondWarn = vi.fn();
    const second = await connectWithClientErrorHandler(pool, { warn: secondWarn });
    expect(client.listenerCount('error')).toBe(1);

    client.emit('error', new Error('backend died'));
    // Only the current checkout's logger is used; the first is not retained.
    expect(secondWarn).toHaveBeenCalledOnce();
    expect(firstWarn).not.toHaveBeenCalled();

    second.release();
  });
});
