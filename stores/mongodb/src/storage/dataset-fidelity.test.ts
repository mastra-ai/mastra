import { randomUUID } from 'node:crypto';
import { createDatasetFidelityTests } from '@internal/storage-test-utils';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoDBConnector } from './connectors/MongoDBConnector';
import { MongoDBDatasetsStorage } from './domains/datasets';

// externalId writes require transactions: run against a replica set, not standalone MongoDB.
describe.skipIf(!process.env.MONGODB_REPLICA_SET_URL)('MongoDB dataset field fidelity', () => {
  const uri = process.env.MONGODB_REPLICA_SET_URL || 'mongodb://localhost:27019/?directConnection=true';
  const dbName = `fidelity_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(uri);
  const connector = new MongoDBConnector({ client, dbName, handler: undefined });
  const storage = new MongoDBDatasetsStorage({ connector });
  beforeAll(() => storage.init());
  afterAll(async () => {
    try {
      await client.db(dbName).dropDatabase();
    } finally {
      await client.close();
    }
  });
  createDatasetFidelityTests(() => storage);

  it.each(['input', 'groundTruth', 'expectedTrajectory'] as const)(
    'rejects NUL-containing keys in %s without partially inserting a batch',
    async field => {
      const dataset = await storage.createDataset({ name: 'invalid-bson-key' });
      const valid = { externalId: 'valid', input: 'valid' };
      await expect(
        storage.batchInsertItems({
          datasetId: dataset.id,
          items: [valid, { externalId: 'invalid', input: 'valid', [field]: { nested: { 'a\u0000b': 1 } } }],
        }),
      ).rejects.toThrow(/null bytes/);
      expect(
        (await storage.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: false } })).items,
      ).toEqual([]);
      expect((await storage.getDatasetById({ id: dataset.id }))?.version).toBe(0);
      const [retried] = await storage.batchInsertItems({ datasetId: dataset.id, items: [valid] });
      expect(retried).toMatchObject({ ...valid, datasetVersion: 1 });
    },
  );
});
