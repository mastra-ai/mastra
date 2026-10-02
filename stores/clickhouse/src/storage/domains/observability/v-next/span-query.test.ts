import { randomUUID } from 'node:crypto';
import { createClient } from '@clickhouse/client';
import { createSpanQueryTests } from '@internal/storage-test-utils';
import { afterAll, beforeAll, vi } from 'vitest';
import { ObservabilityStorageClickhouseVNext } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
const database = `span_query_${randomUUID().replaceAll('-', '')}`;
const config = {
  url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USERNAME ?? 'default',
  password: process.env.CLICKHOUSE_PASSWORD ?? 'password',
};
const admin = createClient(config);
const client = createClient({ ...config, database });
const storage = new ObservabilityStorageClickhouseVNext({ client });
beforeAll(async () => {
  await admin.command({ query: `CREATE DATABASE ${database}` });
  await storage.init();
});
afterAll(async () => {
  await client.close();
  await admin.command({ query: `DROP DATABASE ${database} SYNC` });
  await admin.close();
});
createSpanQueryTests(() => storage, { completionOnly: true });
