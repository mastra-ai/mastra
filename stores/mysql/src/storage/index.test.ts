import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MySQLStore  } from './index';
import type {MySQLStoreConfig} from './index';
import { createTestSuite } from '@internal/storage-test-utils';

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
createTestSuite(store);

afterAll(async () => {
  await store.close();
});
