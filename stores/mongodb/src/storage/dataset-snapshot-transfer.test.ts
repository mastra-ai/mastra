import { randomUUID } from 'node:crypto';
import { createDatasetSnapshotTransferTests, datasetSnapshotTransferFixture } from '@internal/storage-test-utils';
import { Collection, MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoDBConnector } from './connectors/MongoDBConnector';
import { MongoDBDatasetsStorage } from './domains/datasets';

const tables = [
  'mastra_datasets',
  'mastra_dataset_items',
  'mastra_dataset_versions',
  'mastra_dataset_snapshot_identities',
  'mastra_dataset_snapshot_imports',
] as const;

describe.skipIf(!process.env.MONGODB_REPLICA_SET_URL)('MongoDB dataset snapshot transfer', () => {
  const uri = process.env.MONGODB_REPLICA_SET_URL || 'mongodb://localhost:27019/?directConnection=true';
  const dbName = `snapshots_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(uri);
  const db = client.db(dbName);
  const connector = new MongoDBConnector({ client, dbName, handler: undefined });
  const storage = new MongoDBDatasetsStorage({ connector });
  beforeAll(() => storage.init());
  beforeEach(() => storage.dangerouslyClearAll());
  afterAll(async () => {
    try {
      await db.dropDatabase();
    } finally {
      await client.close();
    }
  });
  createDatasetSnapshotTransferTests(() => storage);

  it.each(tables)('rolls back every write when the %s collection rejects a record', async table => {
    await db.command({ collMod: table, validator: { id: { $eq: 'rejected' } }, validationAction: 'error' });
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'failure' };
    try {
      await expect(storage.importSnapshot(request)).rejects.toThrow('Document failed validation');
      for (const name of tables) expect(await db.collection(name).countDocuments({})).toBe(0);
    } finally {
      await db.command({ collMod: table, validator: {} });
    }
    expect((await storage.importSnapshot(request)).datasetExists).toBe(true);
  });

  it('excludes partially deleted data from exports and receipt status while allowing deletion to be retried', async () => {
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'delete' };
    const imported = await storage.importSnapshot(request);
    const original = Collection.prototype.deleteMany;
    const spy = vi.spyOn(Collection.prototype, 'deleteMany').mockImplementation(async function (
      this: Collection,
      ...args: Parameters<typeof original>
    ) {
      if (this.collectionName === 'mastra_dataset_items') {
        await this.deleteOne(args[0]);
        throw new Error('injected partial delete');
      }
      return original.apply(this, args);
    });
    try {
      await expect(storage.deleteDataset({ id: imported.receipt.datasetId })).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await db.collection('mastra_dataset_items').countDocuments({})).toBe(1);
    await expect(
      storage.exportSnapshot({ datasetId: imported.receipt.datasetId, acknowledgeSensitiveData: true }),
    ).rejects.toThrow('deletion is in progress');
    expect(await storage.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual({
      ...imported,
      datasetExists: false,
    });
    expect(await storage.importSnapshot(request)).toEqual({ ...imported, datasetExists: false });
    await storage.deleteDataset({ id: imported.receipt.datasetId });
    expect(await db.collection('mastra_dataset_snapshot_identities').countDocuments({})).toBe(0);
    expect((await storage.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
  });

  it('arbitrates same-key imports across clients and recovers receipts on a fresh connection', async () => {
    const otherClient = new MongoClient(uri);
    const other = new MongoDBDatasetsStorage({
      connector: new MongoDBConnector({ client: otherClient, dbName, handler: undefined }),
    });
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'durable' };
    let original;
    try {
      await other.init();
      const results = await Promise.all([storage.importSnapshot(request), other.importSnapshot(request)]);
      expect(results[0]).toEqual(results[1]);
      original = results[0];
    } finally {
      await otherClient.close();
    }
    const reconnectedClient = new MongoClient(uri);
    try {
      const reconnected = new MongoDBDatasetsStorage({
        connector: new MongoDBConnector({ client: reconnectedClient, dbName, handler: undefined }),
      });
      await reconnected.init();
      expect(await reconnected.importSnapshot(request)).toEqual(original);
      expect(await reconnected.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(original);
      expect((await reconnected.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    } finally {
      await reconnectedClient.close();
    }
  });
});

describe('MongoDB standalone snapshot rejection', () => {
  const dbName = `snapshot_standalone_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
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
  it('fails closed before any snapshot content is written without transaction support', async context => {
    if (await connector.supportsTransactions()) {
      context.skip();
      return;
    }
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'unsupported' };
    await expect(storage.preflightSnapshot(request)).rejects.toThrow('transaction support');
    await expect(storage.importSnapshot(request)).rejects.toThrow('transaction support');
    await expect(storage.exportSnapshot({ datasetId: 'missing', acknowledgeSensitiveData: true })).rejects.toThrow(
      'transaction support',
    );
    for (const name of tables) expect(await client.db(dbName).collection(name).countDocuments({})).toBe(0);
  });
});
