import { beforeEach, describe, expect, it } from 'vitest';
import type { StoredComputerRecord } from './base';
import { InMemoryComputersStorage } from './inmemory';

const record: StoredComputerRecord = {
  schemaVersion: 1,
  id: 'cmp_p2_recovery_mac',
  recoveryId: '0123456789abcdef0123456789abcdef',
  providerId: 'test',
  providerIdentity: { sandboxId: 'sandbox-1' },
  ownerResourceId: 'resource',
  name: 'Computer',
  template: 'desktop',
  createdAt: 1,
};

describe('InMemoryComputersStorage', () => {
  let store: InMemoryComputersStorage;

  beforeEach(() => {
    store = new InMemoryComputersStorage();
  });

  it('stores immutable provider records by resource', async () => {
    await store.setComputer(record);
    const found = await store.getComputer(record.id);
    expect(found).toEqual(record);
    found!.providerIdentity = { sandboxId: 'changed' };
    await expect(store.getComputer(record.id)).resolves.toEqual(record);
    await expect(store.listComputers('resource')).resolves.toEqual([record]);
    await expect(store.listComputers('other')).resolves.toEqual([]);
  });

  it('deletes records idempotently', async () => {
    await store.setComputer(record);
    await store.deleteComputer(record.id);
    await store.deleteComputer(record.id);
    await expect(store.getComputer(record.id)).resolves.toBeUndefined();
  });
});
