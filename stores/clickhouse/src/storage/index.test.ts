import { createTestSuite } from '@internal/storage-test-utils';
import { vi } from 'vitest';
import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  // ttl: {
  //   mastra_traces: {
  //     row: { interval: 600, unit: 'SECOND' },
  //   },
  // },
};

const storage = new ClickhouseStore({ ...TEST_CONFIG, id: 'clickhouse-test' });

createTestSuite(storage);
