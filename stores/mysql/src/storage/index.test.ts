import {
  createDatasetFidelityTests,
  createDatasetSnapshotTransferTests,
  datasetSnapshotTransferFixture,
  createSpan,
  createTestSuite,
} from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetsMySQL } from './domains/datasets';
import { StoreOperationsMySQL } from './domains/operations';

import { MySQLStore } from './index';
import type { MySQLStoreConfig } from './index';

const TEST_CONFIG: MySQLStoreConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database: process.env.MYSQL_DB || 'mastra',
  max: 10,
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('MySQLStore configuration validation', () => {
  it('initializes with minimal config shape', () => {
    expect(() => new MySQLStore(TEST_CONFIG)).not.toThrow();
  });

  it('throws when no connection information provided', () => {
    // @ts-expect-error testing runtime validation
    expect(() => new MySQLStore({})).toThrowError();
  });
});

const store = new MySQLStore(TEST_CONFIG);
// MySQL does not persist tool mocks / tool mock reports — it rejects them.
createTestSuite(store, { toolMocks: false });

describe('MySQL dataset field fidelity', () => {
  const writer = store.stores.datasets;
  if (!writer) throw new Error('MySQL dataset storage is not configured');
  beforeAll(() => writer.init());
  createDatasetFidelityTests(() => writer);

  it.each(['hello 🌎 漢字', { nested: ['hello 🌎 漢字'] }])(
    'preserves Unicode JSON %j when the connection character set is Latin1',
    async value => {
      const dataset = await writer.createDataset({ name: 'unicode-connection' });
      const pool = createPool({
        host: TEST_CONFIG.host,
        port: TEST_CONFIG.port,
        user: TEST_CONFIG.user,
        password: TEST_CONFIG.password,
        database: TEST_CONFIG.database,
        charset: 'latin1',
        connectionLimit: 1,
        dateStrings: true,
      });
      const reader = new DatasetsMySQL({
        pool,
        operations: new StoreOperationsMySQL({ pool, database: TEST_CONFIG.database }),
      });
      try {
        // Keep results UTF-8 while exercising CAST's connection-dependent character set.
        await pool.query('SET character_set_results = utf8mb4');
        const payload = { input: value, groundTruth: value, expectedTrajectory: value };
        const item = await writer.addItem({ datasetId: dataset.id, ...payload });
        expect(await reader.getItemById({ id: item.id })).toMatchObject(payload);
        await writer.updateItem({ datasetId: dataset.id, id: item.id, metadata: { edited: true } });
        await writer.batchDeleteItems({ datasetId: dataset.id, itemIds: [item.id] });
        const history = await reader.getItemHistory(item.id);
        expect(history).toHaveLength(3);
        for (const row of history) expect(row).toMatchObject(payload);
      } finally {
        await pool.end();
        await writer.deleteDataset({ id: dataset.id });
      }
    },
  );
});

describe('MySQL dataset snapshot transfer', () => {
  const poolOptions = {
    host: TEST_CONFIG.host,
    port: TEST_CONFIG.port,
    user: TEST_CONFIG.user,
    password: TEST_CONFIG.password,
    database: TEST_CONFIG.database,
    connectionLimit: 6,
    dateStrings: true,
    timezone: 'Z',
  };
  const pool = createPool(poolOptions);
  const storage = new DatasetsMySQL({
    pool,
    operations: new StoreOperationsMySQL({ pool, database: TEST_CONFIG.database }),
  });
  const tables = [
    'mastra_datasets',
    'mastra_dataset_items',
    'mastra_dataset_versions',
    'mastra_dataset_snapshot_identities',
    'mastra_dataset_snapshot_imports',
  ] as const;
  beforeAll(() => storage.init());
  beforeEach(() => storage.dangerouslyClearAll());
  afterAll(() => pool.end());
  createDatasetSnapshotTransferTests(() => storage, { toolMocks: false });

  it.each(tables)('rolls back every import record when insertion into %s fails', async table => {
    await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT fail_snapshot CHECK (id = 'rejected')`);
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture(false)), idempotencyKey: 'failure' };
    try {
      await expect(storage.importSnapshot(request)).rejects.toThrow('fail_snapshot');
      for (const name of tables) {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${name}`);
        expect(rows[0]!.count).toBe(0);
      }
    } finally {
      await pool.query(`ALTER TABLE ${table} DROP CHECK fail_snapshot`);
    }
    expect((await storage.importSnapshot(request)).datasetExists).toBe(true);
  });

  it('rejects unsupported tool mocks before acquiring a connection or writing a receipt', async () => {
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture()), idempotencyKey: 'unsupported' };
    const spy = vi.spyOn(pool, 'getConnection');
    try {
      await expect(storage.preflightSnapshot(request)).rejects.toThrow('Tool mocks are not supported');
      await expect(storage.importSnapshot(request)).rejects.toThrow('Tool mocks are not supported');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(await storage.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toBeNull();
  });

  it('rolls back when the database cannot preserve snapshot timestamp precision', async () => {
    const [columns] = await pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM mastra_dataset_items WHERE Field = 'updatedAt'",
    );
    const originalType = columns[0]!.Type;
    await pool.query('ALTER TABLE mastra_dataset_items MODIFY updatedAt DATETIME(0) NOT NULL');
    try {
      await expect(
        storage.importSnapshot({
          snapshot: JSON.stringify(datasetSnapshotTransferFixture(false)),
          idempotencyKey: 'corrupt',
        }),
      ).rejects.toThrow('did not preserve');
      expect(await storage.getSnapshotImport({ idempotencyKey: 'corrupt' })).toBeNull();
      expect((await storage.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toEqual([]);
    } finally {
      await pool.query(`ALTER TABLE mastra_dataset_items MODIFY updatedAt ${originalType} NOT NULL`);
    }
  });

  it('arbitrates same-key imports across pools and recovers after reconnecting', async () => {
    const secondPool = createPool(poolOptions);
    const second = new DatasetsMySQL({
      pool: secondPool,
      operations: new StoreOperationsMySQL({ pool: secondPool, database: TEST_CONFIG.database }),
    });
    const request = { snapshot: JSON.stringify(datasetSnapshotTransferFixture(false)), idempotencyKey: 'durable' };
    let original;
    try {
      await second.init();
      const results = await Promise.all([storage.importSnapshot(request), second.importSnapshot(request)]);
      expect(results[0]).toEqual(results[1]);
      original = results[0];
    } finally {
      await secondPool.end();
    }
    const reconnectPool = createPool(poolOptions);
    try {
      const reconnect = new DatasetsMySQL({
        pool: reconnectPool,
        operations: new StoreOperationsMySQL({ pool: reconnectPool, database: TEST_CONFIG.database }),
      });
      await reconnect.init();
      expect(await reconnect.importSnapshot(request)).toEqual(original);
      expect(await reconnect.getSnapshotImport({ idempotencyKey: request.idempotencyKey })).toEqual(original);
      expect((await reconnect.listDatasets({ pagination: { page: 0, perPage: false } })).datasets).toHaveLength(1);
    } finally {
      await reconnectPool.end();
    }
  });
});

afterAll(async () => {
  await store.close();
});

describe('retention', () => {
  it('prunes expired observability spans in bounded batches', async () => {
    const retentionStore = new MySQLStore({
      ...TEST_CONFIG,
      id: 'mysql-retention-test',
      retention: { observability: { spans: { maxAge: '30d', batchSize: 1 } } },
    });

    try {
      await retentionStore.init();
      const observability = await retentionStore.getStore('observability');
      expect(observability).toBeDefined();
      await observability!.dangerouslyClearAll();
      await observability!.createSpan({
        span: createSpan({ traceId: 'expired', spanId: 'expired', startedAt: new Date(Date.now() - 31 * 86_400_000) }),
      });
      await observability!.createSpan({
        span: createSpan({
          traceId: 'retained',
          spanId: 'retained',
          startedAt: new Date(Date.now() - 29 * 86_400_000),
        }),
      });

      await expect(retentionStore.prune()).resolves.toEqual([
        { domain: 'observability', table: 'mastra_ai_spans', deleted: 1, done: true },
      ]);
      await expect(observability!.getTrace({ traceId: 'expired' })).resolves.toBeNull();
      await expect(observability!.getTrace({ traceId: 'retained' })).resolves.not.toBeNull();
    } finally {
      await retentionStore.close();
    }
  });
});
