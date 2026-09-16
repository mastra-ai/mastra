import { createMemoryTokenBoundaryConformanceTest, createTestSuite } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { MemoryMySQL } from './domains/memory';
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

createMemoryTokenBoundaryConformanceTest({
  createStores: async () => {
    const firstPool = createPool(TEST_CONFIG);
    const secondPool = createPool(TEST_CONFIG);
    const first = new MemoryMySQL({ pool: firstPool, database: TEST_CONFIG.database });
    const second = new MemoryMySQL({ pool: secondPool, database: TEST_CONFIG.database });
    await first.init();
    await second.init();
    return {
      first,
      second,
      cleanup: async () => {
        await Promise.all([firstPool.end(), secondPool.end()]);
      },
    };
  },
});

afterAll(async () => {
  await store.close();
});
