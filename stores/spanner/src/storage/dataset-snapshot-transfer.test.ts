import { randomUUID } from 'node:crypto';
import { Spanner } from '@google-cloud/spanner';
import { createDatasetSnapshotTransferTests, datasetSnapshotTransferFixture } from '@internal/storage-test-utils';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpannerDB } from './db';
import { DatasetsSpanner } from './domains/datasets';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
const tables = [
  'mastra_datasets',
  'mastra_dataset_items',
  'mastra_dataset_versions',
  'mastra_dataset_snapshot_identities',
  'mastra_dataset_snapshot_imports',
] as const;

describe.skipIf(process.env.ENABLE_TESTS !== 'true')('Spanner dataset snapshot transfer', () => {
  process.env.SPANNER_EMULATOR_HOST ||= 'localhost:9010';
  const projectId = process.env.SPANNER_PROJECT_ID || 'test-project';
  const client = new Spanner({ projectId });
  const instanceId = `snapshots-${randomUUID().slice(0, 8)}`;
  const instance = client.instance(instanceId);
  const database = instance.database('dataset-snapshots');
  const storage = new DatasetsSpanner({ database });
  beforeAll(async () => {
    const [, instanceOperation] = await client.createInstance(instanceId, {
      config: 'emulator-config',
      nodes: 1,
      displayName: instanceId,
    });
    await instanceOperation.promise();
    const [, operation] = await instance.createDatabase(database.id);
    await operation.promise();
    await storage.init();
  });
  beforeEach(() => storage.dangerouslyClearAll());
  afterAll(async () => {
    try {
      await database.close();
      await instance.delete();
    } finally {
      await client.close();
    }
  });
  createDatasetSnapshotTransferTests(() => storage);

  it.each(tables)('rolls back all records when %s rejects an import write', async table => {
    const [added] = await database.updateSchema(
      `ALTER TABLE ${table} ADD CONSTRAINT reject_snapshot CHECK (id = 'rejected')`,
    );
    await added.promise();
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'failure' };
    try {
      await expect(storage.importSnapshot(request)).rejects.toThrow();
      for (const name of tables) {
        const [rows] = await database.run(`SELECT id FROM ${name}`);
        expect(rows).toHaveLength(0);
      }
    } finally {
      const [dropped] = await database.updateSchema(`ALTER TABLE ${table} DROP CONSTRAINT reject_snapshot`);
      await dropped.promise();
    }
    expect((await storage.importSnapshot(request)).datasetExists).toBe(true);
  });

  it('replays an aborted transaction without publishing duplicate records', async () => {
    const original = SpannerDB.prototype.insert;
    let aborted = false;
    const spy = vi.spyOn(SpannerDB.prototype, 'insert').mockImplementation(async function (this: SpannerDB, input) {
      await original.call(this, input);
      if (input.tableName === 'mastra_datasets' && !aborted) {
        aborted = true;
        throw Object.assign(new Error('injected abort after write'), { code: 10 });
      }
    });
    try {
      const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'abort' };
      const result = await storage.importSnapshot(request);
      expect(aborted).toBe(true);
      expect(await storage.importSnapshot(request)).toEqual(result);
      expect((await storage.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
      expect(
        (await storage.listItems({ datasetId: result.receipt.datasetId, pagination: { page: 0, perPage: false } }))
          .items,
      ).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('rolls back a persisted timestamp mismatch before the receipt is committed', async () => {
    const original = SpannerDB.prototype.insert;
    const spy = vi.spyOn(SpannerDB.prototype, 'insert').mockImplementation(async function (this: SpannerDB, input) {
      return original.call(
        this,
        input.tableName === 'mastra_dataset_items'
          ? { ...input, record: { ...input.record, updatedAt: new Date('2026-01-01T00:00:00Z') } }
          : input,
      );
    });
    try {
      await expect(
        storage.importSnapshot({
          snapshot: JSON.stringify(datasetSnapshotTransferFixture()),
          idempotencyKey: 'corrupt',
        }),
      ).rejects.toThrow('did not preserve');
      for (const name of tables) {
        const [rows] = await database.run(`SELECT id FROM ${name}`);
        expect(rows).toHaveLength(0);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('arbitrates same-key imports across clients and recovers committed receipts after reconnecting', async () => {
    const secondClient = new Spanner({ projectId });
    const secondDatabase = secondClient.instance(instanceId).database(database.id);
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'durable' };
    let original;
    try {
      const second = new DatasetsSpanner({ database: secondDatabase });
      await second.init();
      const results = await Promise.all([storage.importSnapshot(request), second.importSnapshot(request)]);
      expect(results[0]).toEqual(results[1]);
      original = results[0];
    } finally {
      await secondDatabase.close();
      await secondClient.close();
    }
    const thirdClient = new Spanner({ projectId });
    const thirdDatabase = thirdClient.instance(instanceId).database(database.id);
    try {
      const reconnected = new DatasetsSpanner({ database: thirdDatabase });
      await reconnected.init();
      expect(await reconnected.importSnapshot(request)).toEqual(original);
      expect(await reconnected.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(original);
      expect((await reconnected.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    } finally {
      await thirdDatabase.close();
      await thirdClient.close();
    }
  });
});
