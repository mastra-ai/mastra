import { randomUUID } from 'node:crypto';
import { createDatasetSnapshotTransferTests, datasetSnapshotTransferFixture } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DatasetsPG } from './domains/datasets';
import { connectionString } from './test-utils';

const tables = [
  'mastra_datasets',
  'mastra_dataset_items',
  'mastra_dataset_versions',
  'mastra_dataset_snapshot_identities',
  'mastra_dataset_snapshot_imports',
] as const;

describe('PostgreSQL dataset snapshot transfer', () => {
  const schemaName = `snapshots_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString });
  const storage = new DatasetsPG({ pool, schemaName });
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await storage.init();
  });
  beforeEach(() => storage.dangerouslyClearAll());
  afterAll(async () => {
    try {
      await pool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  createDatasetSnapshotTransferTests(() => storage);

  it.each(tables)('rolls back the receipt and all content when inserting into %s fails', async table => {
    await pool.query(
      `CREATE OR REPLACE FUNCTION "${schemaName}".fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
    );
    await pool.query(
      `CREATE TRIGGER fail_import BEFORE INSERT ON "${schemaName}".${table} FOR EACH ROW EXECUTE FUNCTION "${schemaName}".fail_snapshot()`,
    );
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'failure' };
    try {
      await expect(storage.importSnapshot(request)).rejects.toThrow('injected failure');
      for (const tableName of tables) {
        const result = await pool.query(`SELECT COUNT(*)::int AS count FROM "${schemaName}".${tableName}`);
        expect(result.rows[0].count).toBe(0);
      }
    } finally {
      await pool.query(`DROP TRIGGER fail_import ON "${schemaName}".${table}`);
    }
    expect((await storage.importSnapshot(request)).datasetExists).toBe(true);
  });

  it('detects corrupted persisted values before committing any import records', async () => {
    await pool.query(
      `CREATE FUNCTION "${schemaName}".corrupt_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW."groundTruth" := NULL; RETURN NEW; END $$`,
    );
    await pool.query(
      `CREATE TRIGGER corrupt_import BEFORE INSERT ON "${schemaName}".mastra_dataset_items FOR EACH ROW EXECUTE FUNCTION "${schemaName}".corrupt_snapshot()`,
    );
    try {
      await expect(
        storage.importSnapshot({
          snapshot: JSON.stringify(datasetSnapshotTransferFixture()),
          idempotencyKey: 'corrupt',
        }),
      ).rejects.toThrow('did not preserve');
      for (const table of tables) {
        expect((await pool.query(`SELECT COUNT(*)::int AS count FROM "${schemaName}".${table}`)).rows[0].count).toBe(0);
      }
    } finally {
      await pool.query(`DROP TRIGGER corrupt_import ON "${schemaName}".mastra_dataset_items`);
    }
  });

  it('arbitrates imports across independent pools and recovers receipts after reconnecting', async () => {
    const secondPool = new Pool({ connectionString });
    const second = new DatasetsPG({ pool: secondPool, schemaName });
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'independent' };
    let original;
    try {
      await second.init();
      const results = await Promise.all([storage.importSnapshot(request), second.importSnapshot(request)]);
      expect(results[0]).toEqual(results[1]);
      original = results[0];
    } finally {
      await secondPool.end();
    }
    const reconnectedPool = new Pool({ connectionString });
    try {
      const reconnected = new DatasetsPG({ pool: reconnectedPool, schemaName });
      await reconnected.init();
      expect(await reconnected.importSnapshot(request)).toEqual(original);
      expect(await reconnected.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(original);
      expect((await reconnected.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    } finally {
      await reconnectedPool.end();
    }
  });
});
