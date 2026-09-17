import { createDatasetFidelityTests, createTestSuite } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

afterAll(async () => {
  await store.close();
});
