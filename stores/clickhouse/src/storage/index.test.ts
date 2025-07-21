import { createSampleTraceForDB, createTestSuite } from '@internal/storage-test-utils';
import { expect, test, vi } from 'vitest';

import { ClickhouseStore } from '.';
import type { ClickhouseConfig } from '.';
import { TABLE_TRACES } from '@mastra/core/storage';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TEST_CONFIG: ClickhouseConfig = {
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  // ttl: {
  //   mastra_traces: {
  //     row: { interval: 600, unit: 'SECOND' },
  //   },
  //   mastra_evals: {
  //     columns: {
  //       result: { interval: 10, unit: 'SECOND' },
  //     },
  //   },
  // },
};

const storage = new ClickhouseStore(TEST_CONFIG);

createTestSuite(storage);
