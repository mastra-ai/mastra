/**
 * Shared observability vNext conformance suite against ClickHouse.
 *
 * Split from index.test.ts so the two halves run as separate files in parallel.
 * Requires a running ClickHouse instance. Use `docker compose up -d` in the
 * clickhouse store directory, or set CLICKHOUSE_URL/CLICKHOUSE_USERNAME/CLICKHOUSE_PASSWORD.
 */
import { createClient } from '@clickhouse/client';
import { createObservabilityVNextTests } from '@internal/storage-test-utils';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { vi } from 'vitest';
import { ObservabilityStorageClickhouseVNext } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Reuse a single ClickHouse storage instance across the shared suite. init()
// is expensive (DDL + MVs + migrations) and running it per-test triggers
// container crashes under ARM emulation. dangerouslyClearAll() truncates the
// signal tables between tests, giving the same isolation as a fresh instance.
let sharedSuiteStorage: ObservabilityStorageClickhouseVNext | undefined;

createObservabilityVNextTests({
  capabilities: {
    label: 'ClickHouse vNext',
    preferredStrategy: 'insert-only',
    traceQuery: true,
    traceQueryDiscovery: true,
    threadQuery: true,
    traceQuerySpanWriteModel: 'completion-only',
  },
  getStorage: async () => {
    if (!sharedSuiteStorage) {
      sharedSuiteStorage = new ObservabilityStorageClickhouseVNext({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USERNAME || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || 'password',
      });
      await sharedSuiteStorage.init();
    }
    return sharedSuiteStorage as unknown as ObservabilityStorage;
  },
  cleanup: async storage => {
    await storage.dangerouslyClearAll();
  },
  // ClickHouse vNext serves discovery from refreshable materialized views.
  // In production they refresh on a schedule; in tests we need to trigger the
  // refresh by hand so discovery reads see writes from the same test.
  refreshDiscovery: async () => {
    const { MV_DISCOVERY_VALUES, MV_DISCOVERY_PAIRS } = await import('./ddl');
    const client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'password',
    });
    try {
      await client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_VALUES}` });
      await client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_VALUES}` });
      await client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_PAIRS}` });
      await client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_PAIRS}` });
    } finally {
      await client.close();
    }
  },
  // ClickHouse vNext dedups signal-table inserts via ReplacingMergeTree
  // background merges. In retry-idempotency tests we force the merge with
  // OPTIMIZE ... FINAL so the read assertion sees the collapsed row.
  flushPendingMerges: async () => {
    const {
      TABLE_LOG_EVENTS,
      TABLE_METRIC_EVENTS,
      TABLE_SCORE_EVENTS,
      TABLE_SCORE_EVENTS_CURRENT,
      TABLE_FEEDBACK_EVENTS,
    } = await import('./ddl');
    const client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || 'password',
    });
    try {
      for (const table of [
        TABLE_LOG_EVENTS,
        TABLE_METRIC_EVENTS,
        TABLE_SCORE_EVENTS,
        TABLE_SCORE_EVENTS_CURRENT,
        TABLE_FEEDBACK_EVENTS,
      ]) {
        await client.command({ query: `OPTIMIZE TABLE ${table} FINAL` });
      }
    } finally {
      await client.close();
    }
  },
});
