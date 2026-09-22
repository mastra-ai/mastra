import { createSpan, createTestSuite } from '@internal/storage-test-utils';
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
// MySQL does not persist tool mocks / tool mock reports — it rejects them.
createTestSuite(store, { toolMocks: false });

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
