import { describe, expect, it, vi } from 'vitest';

import { PlatformComputerControlPermanentError, PlatformComputerControlSubscriber } from './computer-control.js';
import type { PlatformComputerControlLease } from './computer-control.js';

const identity = {
  sandboxId: 'row-1',
  provider: 'railway',
  providerResourceId: 'rw-1',
  generation: 'generation-1',
};
const scope = { resourceId: 'resource', threadId: 'thread' };
const control = { holder: 'human' as const, revision: 3 };
const lease: PlatformComputerControlLease = { epoch: 7, fencingToken: 'fence-7', expiresAt: 20_000 };

function setup(overrides: {
  resolve?: () => Promise<typeof identity | null>;
  acquire?: () => Promise<PlatformComputerControlLease>;
  renew?: () => Promise<PlatformComputerControlLease>;
  apply?: () => Promise<void>;
  observe?: () => Promise<{ revision: number; mode: 'agent' | 'human'; epoch: number; fencingToken: string }>;
} = {}) {
  const identityResolver = {
    resolve: vi.fn(overrides.resolve ?? (async () => identity)),
  };
  const leaseClient = {
    acquire: vi.fn(overrides.acquire ?? (async () => lease)),
    renew: vi.fn(overrides.renew ?? (async () => lease)),
    apply: vi.fn(overrides.apply ?? (async () => {})),
    observe: vi.fn(
      overrides.observe ??
        (async () => ({ revision: 3, mode: 'human' as const, epoch: lease.epoch, fencingToken: lease.fencingToken })),
    ),
  };
  const subscriber = new PlatformComputerControlSubscriber({
    identityResolver,
    leaseClient,
    now: () => 10_000,
    minLeaseRemainingMs: 5_000,
  });
  const enforce = () =>
    subscriber.enforce({
      computerId: 'computer',
      scope,
      identity: { providerId: 'platform', sandboxId: 'row-1' },
      control,
      signal: new AbortController().signal,
    });
  return { subscriber, identityResolver, leaseClient, enforce };
}

describe('PlatformComputerControlSubscriber', () => {
  it('acknowledges only the observed revision under the acquired fence', async () => {
    const { identityResolver, leaseClient, enforce } = setup();

    await expect(enforce()).resolves.toEqual({ status: 'enforced', enforcedRevision: 3 });
    expect(identityResolver.resolve).toHaveBeenCalledWith({
      identity: { providerId: 'platform', sandboxId: 'row-1' },
      scope,
      signal: expect.any(AbortSignal),
    });
    expect(leaseClient.apply).toHaveBeenCalledWith(expect.objectContaining({ identity, lease, revision: 3, mode: 'human' }));
  });

  it('renews an expiring lease before applying the projection', async () => {
    const expiring = { ...lease, expiresAt: 12_000 };
    const renewed = { ...lease, epoch: 8, fencingToken: 'fence-8', expiresAt: 30_000 };
    const { leaseClient, enforce } = setup({
      acquire: async () => expiring,
      renew: async () => renewed,
      observe: async () => ({ revision: 3, mode: 'human', epoch: 8, fencingToken: 'fence-8' }),
    });

    await expect(enforce()).resolves.toEqual({ status: 'enforced', enforcedRevision: 3 });
    expect(leaseClient.renew).toHaveBeenCalledWith(expect.objectContaining({ lease: expiring, revision: 3 }));
    expect(leaseClient.apply).toHaveBeenCalledWith(expect.objectContaining({ lease: renewed }));
  });

  it('stays pending when the renewed lease is still expiring', async () => {
    const expiring = { ...lease, expiresAt: 12_000 };
    const { leaseClient, enforce } = setup({ acquire: async () => expiring, renew: async () => expiring });

    await expect(enforce()).resolves.toEqual({ status: 'retryable', error: 'platform computer control lease is expiring' });
    expect(leaseClient.apply).not.toHaveBeenCalled();
  });

  it('rejects stale observations and unverifiable identities', async () => {
    const stale = setup({ observe: async () => ({ revision: 2, mode: 'human', epoch: 7, fencingToken: 'fence-7' }) });
    await expect(stale.enforce()).resolves.toEqual({
      status: 'retryable',
      error: 'platform computer control projection is not current',
    });

    const missing = setup({ resolve: async () => null });
    await expect(missing.enforce()).resolves.toEqual({
      status: 'permanent',
      error: 'platform computer identity could not be verified',
    });
  });

  it('maps permanent errors and shutdown aborts without acknowledging', async () => {
    const permanent = setup({
      resolve: async () => {
        throw new PlatformComputerControlPermanentError('sandbox was destroyed');
      },
    });
    await expect(permanent.enforce()).resolves.toEqual({ status: 'permanent', error: 'sandbox was destroyed' });

    const shutdown = setup();
    shutdown.subscriber.close();
    await expect(shutdown.enforce()).resolves.toMatchObject({ status: 'retryable' });
    expect(shutdown.leaseClient.acquire).not.toHaveBeenCalled();
  });
});
