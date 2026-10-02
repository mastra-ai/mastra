import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRunFencingTests } from '../../../_test-utils/src/domains/run-fencing';
import { MongoDBStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Fenced writes need transactions: run against a replica set, not standalone MongoDB.
describe.skipIf(!process.env.MONGODB_REPLICA_SET_URL)('MongoDB run fencing', () => {
  const uri = process.env.MONGODB_REPLICA_SET_URL || 'mongodb://localhost:27019/?directConnection=true';
  const dbName = `fencing_${randomUUID().replaceAll('-', '')}`;
  const store = new MongoDBStore({ id: 'mongodb-run-fencing', uri, dbName });

  beforeAll(() => store.init());
  afterAll(async () => {
    const client = new MongoClient(uri);
    try {
      await client.db(dbName).dropDatabase();
    } finally {
      await client.close();
      await store.close();
    }
  });

  it('declares fencing on a replica set', async () => {
    expect((await store.getStore('workflows'))?.supportsRunFencing()).toBe(true);
    expect((await store.getStore('memory'))?.supportsRunFencing()).toBe(true);
  });

  createRunFencingTests({ storage: store });
});
