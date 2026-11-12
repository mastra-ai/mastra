import type { MastraCompositeStore } from '../../../storage/base';

/**
 * Takes the leases under `keys` from whoever holds them and lets them lapse,
 * as they do when the holding process crashes. In-process tests simulate a
 * crash by leaving a step hanging, and the hung step keeps renewing its step
 * lease and its run's liveness key. Shut the hanging host down first: its
 * renewal timer stops vouching for the run then, and cannot write the
 * liveness key again after this.
 */
export async function abandonLease(storage: MastraCompositeStore, ...keys: string[]): Promise<void> {
  const store = (await storage.getStore('workflows'))!;
  for (const key of keys) {
    await store.claimRunOwnership({ runId: key, ownerId: 'crashed-process', leaseMs: 1, force: true });
  }

  // The store's clock decides when a lease has lapsed.
  for (const key of keys) {
    while ((await store.getRunOwnership({ runId: key }))?.live) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
}
