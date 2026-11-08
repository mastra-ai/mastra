import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { StoredComputerRecord } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComputersLibSQL } from './index';

const record: StoredComputerRecord = {
  schemaVersion: 1,
  id: 'cmp_p2_0123456789abcdef0123456789abcdef_mac',
  recoveryId: '0123456789abcdef0123456789abcdef',
  providerId: 'test',
  providerIdentity: { sandboxId: 'sandbox-1' },
  ownerResourceId: 'resource',
  name: 'Computer',
  template: 'desktop',
  createdAt: 1,
};

describe('ComputersLibSQL', () => {
  let client: Client;
  let store: ComputersLibSQL;

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:?cache=shared' });
    store = new ComputersLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(() => client.close());

  it('round-trips and lists durable records', async () => {
    await store.setComputer(record);
    await expect(store.getComputer(record.id)).resolves.toEqual(record);
    await expect(store.listComputers('resource')).resolves.toEqual([record]);
    await expect(store.listComputers('other')).resolves.toEqual([]);
  });

  it('survives a fresh store instance and deletes idempotently', async () => {
    await store.setComputer(record);
    const reopened = new ComputersLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await reopened.init();
    await expect(reopened.getComputer(record.id)).resolves.toEqual(record);
    await reopened.deleteComputer(record.id);
    await reopened.deleteComputer(record.id);
    await expect(reopened.getComputer(record.id)).resolves.toBeUndefined();
  });
});
