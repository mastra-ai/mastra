import type { MastraCompositeStore } from '../../../storage/base';

/**
 * Takes the lease under `key` from whoever holds it and lets it lapse, as it
 * does when the holding process crashes. In-process tests simulate a crash by
 * leaving a step hanging, and the hung step would keep renewing its lease.
 */
export async function abandonLease(storage: MastraCompositeStore, key: string): Promise<void> {
  const store = (await storage.getStore('workflows'))!;
  await store.claimRunOwnership({ runId: key, ownerId: 'crashed-process', leaseMs: 1, force: true });
  await new Promise(resolve => setTimeout(resolve, 5));
}
