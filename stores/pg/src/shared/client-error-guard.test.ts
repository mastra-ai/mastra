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

  it('detach() removes the listener', () => {
    const client = makeFakeClient();
    const detach = attachClientErrorHandler(client);
    expect(client.listenerCount('error')).toBe(1);

    detach();
    expect(client.listenerCount('error')).toBe(0);
    // Idempotent: a second detach is a no-op.
    detach();
    expect(client.listenerCount('error')).toBe(0);
  });

  it('routes the error to the provided logger', () => {
    const client = makeFakeClient();
    const warn = vi.fn();
    attachClientErrorHandler(client, { warn });

    client.emit('error', new Error('boom'));

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![1]).toMatchObject({ err: 'boom' });
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

  it('detaches the listener when the client is released', async () => {
    const client = makeFakeClient();
    const originalRelease = client.release;
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);
    expect(client.listenerCount('error')).toBe(1);

    checkedOut.release();

    expect(client.listenerCount('error')).toBe(0);
    expect(originalRelease).toHaveBeenCalledOnce();
  });

  it('forwards the release error argument to the underlying release', async () => {
    const client = makeFakeClient();
    const originalRelease = client.release;
    const pool = makeFakePool(client);

    const checkedOut = await connectWithClientErrorHandler(pool);
    const err = new Error('discard me');
    checkedOut.release(err);

    expect(originalRelease).toHaveBeenCalledWith(err);
    expect(client.listenerCount('error')).toBe(0);
  });
});
