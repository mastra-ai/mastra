import { createTestSuite } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';

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
const catalogPool = createPool({
  host: TEST_CONFIG.host,
  port: TEST_CONFIG.port,
  user: TEST_CONFIG.user,
  password: TEST_CONFIG.password,
  database: TEST_CONFIG.database,
  connectionLimit: 1,
});
// MySQL does not persist tool mocks / tool mock reports — it rejects them.
createTestSuite(store, { toolMocks: false });

describe('MySQL memory default indexes', () => {
  it('creates resource-scoped threads and messages composite indexes', async () => {
    await store.init();

    await expectIndexColumns('mastra_threads', 'mastra_threads_resourceid_id_idx', ['resourceId', 'id']);
    await expectIndexColumns('mastra_messages', 'mastra_messages_resourceid_thread_id_idx', [
      'resourceId',
      'thread_id',
    ]);
  });
});

async function expectIndexColumns(tableName: string, indexName: string, columns: string[]): Promise<void> {
  const [rows] = await catalogPool.query(
    `SELECT COLUMN_NAME AS columnName
     FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?
     ORDER BY SEQ_IN_INDEX`,
    [TEST_CONFIG.database, tableName, indexName],
  );

  expect((rows as Array<{ columnName: string }>).map(row => row.columnName)).toEqual(columns);
}

afterAll(async () => {
  await Promise.all([store.close(), catalogPool.end()]);
});
