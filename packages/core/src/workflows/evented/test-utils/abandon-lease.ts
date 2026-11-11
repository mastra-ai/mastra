import type { MastraCompositeStore } from '../../../storage/base';

/**
 * Takes the leases under `keys` from whoever holds them and lets them lapse,
 * as they do when the holding process crashes. In-process tests simulate a
 * crash by leaving a step hanging, and the hung step would keep renewing its
 * step lease and its run's liveness key. Shut the hanging host down first when
 * the test runs with a short lease TTL, so its next renewal tick does not
 * write the liveness key again.
 */
export async function abandonLease(storage: MastraCompositeStore, ...keys: string[]): Promise<void> {
  const store = (await storage.getStore('workflows'))!;
  for (const key of keys) {
    await store.claimRunOwnership({ runId: key, ownerId: 'crashed-process', leaseMs: 1, force: true });
  }
  await new Promise(resolve => setTimeout(resolve, 5));
}
