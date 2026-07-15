import { coreFeatures } from '@mastra/core/features';
import { SpanType } from '@mastra/core/observability';
import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DbClient, QueryValues } from '../../../client';
import { PoolAdapter } from '../../../client';
import { PostgresStoreVNext } from '../../../index';
import { connectionString, TEST_CONFIG } from '../../../test-utils';
import { ALL_SIGNAL_TABLES, qualifiedTable, TABLE_DISCOVERY, TABLE_LOG_EVENTS, TABLE_SPAN_EVENTS } from './ddl';
import { ensurePartmanHypertables } from './partitioning';
import { decodeDeltaCursor } from './polling';
import { ObservabilityStoragePostgresVNext } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const integrationEnabled = process.env.PG_VNEXT_INTEGRATION_TESTS === '1';
const TIMESCALE_URL = process.env.PG_VNEXT_TIMESCALE_URL ?? 'postgres://postgres:postgres@localhost:5435/mastra';
const PARTMAN_URL = process.env.PG_VNEXT_PARTMAN_URL ?? 'postgres://postgres:postgres@localhost:5436/mastra';

const defaultConnection = {
  connectionString,
  host: (TEST_CONFIG as { host: string }).host,
  port: (TEST_CONFIG as { port: number }).port,
  database: (TEST_CONFIG as { database: string }).database,
  user: (TEST_CONFIG as { user: string }).user,
  password: (TEST_CONFIG as { password: string }).password,
};

afterEach(() => {
  vi.restoreAllMocks();
});

type TestConnection = typeof defaultConnection;

interface DomainHarness {
  schema: string;
  client: DbClient;
  baseClient: PoolAdapter;
  domain: ObservabilityStoragePostgresVNext;
  close: () => Promise<void>;
}

function parseConnectionString(url: string): TestConnection {
  const parsed = new URL(url);
  return {
    connectionString: url,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function schemaName(prefix: string): string {
  const normalized = prefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 52)
    .replace(/_+$/g, '');
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${normalized || 'obs'}_${suffix}`;
}

function quotedIdentifier(value: string): string {
  return `"${value}"`;
}

function dayAt(dayOffset: number, hour = 12, minute = 0, second = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, minute, second),
  );
}

function yyyymmdd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function withDeltaPolling<T>(fn: () => Promise<T>): Promise<T> {
  const hadFlag = coreFeatures.has('observability-delta-polling');
  coreFeatures.add('observability-delta-polling');
  try {
    return await fn();
  } finally {
    if (!hadFlag) {
      coreFeatures.delete('observability-delta-polling');
    }
  }
}

async function createHarness(options: {
  connection?: TestConnection;
  schemaPrefix: string;
  autoInit?: boolean;
  partitioning?: ConstructorParameters<typeof ObservabilityStoragePostgresVNext>[0]['partitioning'];
  discovery?: ConstructorParameters<typeof ObservabilityStoragePostgresVNext>[0]['discovery'];
  setupDatabase?: (client: DbClient) => Promise<void>;
  wrapClient?: (client: PoolAdapter) => DbClient;
}): Promise<DomainHarness> {
  const connection = options.connection ?? defaultConnection;
  const pool = new Pool({ connectionString: connection.connectionString, max: 2 });
  const baseClient = new PoolAdapter(pool);
  const schema = schemaName(options.schemaPrefix);

  await baseClient.none(`CREATE SCHEMA IF NOT EXISTS ${quotedIdentifier(schema)}`);
  if (options.setupDatabase) {
    await options.setupDatabase(baseClient);
  }

  const client = options.wrapClient ? options.wrapClient(baseClient) : baseClient;
  const domain = new ObservabilityStoragePostgresVNext({
    client,
    schemaName: schema,
    partitioning: options.partitioning,
    discovery: options.discovery,
  });

  if (options.autoInit !== false) {
    await domain.init();
  }

  return {
    schema,
    client,
    baseClient,
    domain,
    close: async () => {
      try {
        await baseClient.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
      } finally {
        await pool.end();
      }
    },
  };
}

function wrapClient(
  client: PoolAdapter,
  overrides: Partial<Record<keyof DbClient, (...args: any[]) => Promise<any>>>,
): DbClient {
  return {
    $pool: client.$pool,
    connect: () => (overrides.connect ? overrides.connect() : client.connect()),
    none: (query: string, values?: QueryValues) =>
      overrides.none ? overrides.none(query, values) : client.none(query, values),
    one: <T>(query: string, values?: QueryValues) =>
      overrides.one ? overrides.one(query, values) : client.one<T>(query, values),
    oneOrNone: <T>(query: string, values?: QueryValues) =>
      overrides.oneOrNone ? overrides.oneOrNone(query, values) : client.oneOrNone<T>(query, values),
    any: <T>(query: string, values?: QueryValues) =>
      overrides.any ? overrides.any(query, values) : client.any<T>(query, values),
    manyOrNone: <T>(query: string, values?: QueryValues) =>
      overrides.manyOrNone ? overrides.manyOrNone(query, values) : client.manyOrNone<T>(query, values),
    many: <T>(query: string, values?: QueryValues) =>
      overrides.many ? overrides.many(query, values) : client.many<T>(query, values),
    query: (query: string, values?: QueryValues) =>
      overrides.query ? overrides.query(query, values) : client.query(query, values),
    tx: callback => (overrides.tx ? overrides.tx(callback) : client.tx(callback)),
  };
}

function makeSpan(overrides: Partial<Record<string, unknown>> = {}) {
  const startedAt = (overrides.startedAt as Date | undefined) ?? dayAt(0, 10);
  const endedAt = (overrides.endedAt as Date | undefined) ?? new Date(startedAt.getTime() + 1_000);

  return {
    traceId: `trace-${crypto.randomUUID()}`,
    spanId: `span-${crypto.randomUUID()}`,
    name: 'root-span',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    startedAt,
    endedAt,
    serviceName: 'svc-observability',
    environment: 'test',
    tags: ['vnext'],
    ...overrides,
  };
}

function makeMetric(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    metricId: `metric-${crypto.randomUUID()}`,
    timestamp: dayAt(0, 11),
    name: 'mastra_latency_ms',
    value: 1,
    labels: {},
    estimatedCost: 0.01,
    costUnit: 'usd',
    tags: ['vnext'],
    ...overrides,
  };
}

function makeLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    logId: `log-${crypto.randomUUID()}`,
    timestamp: dayAt(0, 11),
    level: 'info' as const,
    message: 'test-log',
    data: null,
    tags: ['vnext'],
    ...overrides,
  };
}

function makeScore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    scoreId: `score-${crypto.randomUUID()}`,
    timestamp: dayAt(0, 11),
    traceId: `score-trace-${crypto.randomUUID()}`,
    spanId: null,
    scorerId: 'quality',
    score: 0.5,
    reason: null,
    tags: ['vnext'],
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    feedbackId: `feedback-${crypto.randomUUID()}`,
    timestamp: dayAt(0, 11),
    traceId: `feedback-trace-${crypto.randomUUID()}`,
    spanId: null,
    feedbackType: 'rating',
    feedbackSource: 'user',
    value: 1,
    comment: null,
    feedbackUserId: null,
    sourceId: null,
    tags: ['vnext'],
    ...overrides,
  };
}

async function ensureTimescale(client: DbClient): Promise<void> {
  await client.none('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
}

async function ensurePartman(client: DbClient): Promise<void> {
  await client.none('CREATE SCHEMA IF NOT EXISTS partman');
  await client.none('CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman');
}

async function readPartmanVersion(client: DbClient): Promise<string | null> {
  const row = await client.oneOrNone<{ extversion: string }>(
    `SELECT extversion FROM pg_extension WHERE extname = 'pg_partman'`,
  );
  return row?.extversion ?? null;
}

async function countRows(client: DbClient, schema: string, table: string): Promise<number> {
  const row = await client.one<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${qualifiedTable(schema, table)}`,
  );
  return Number(row.count);
}

async function readCursorId(
  client: DbClient,
  schema: string,
  table: string,
  idColumn: string,
  idValue: string,
): Promise<number> {
  const row = await client.one<{ cursorId: string }>(
    `SELECT "cursorId"::text AS "cursorId"
     FROM ${qualifiedTable(schema, table)}
     WHERE ${quotedIdentifier(idColumn)} = $1`,
    [idValue],
  );
  return Number(row.cursorId);
}

function expectCursorAtOrAfter(actual: string, expected: string): void {
  const actualCursor = decodeDeltaCursor(actual);
  const expectedCursor = decodeDeltaCursor(expected);
  const actualXact = BigInt(actualCursor.xactId);
  const expectedXact = BigInt(expectedCursor.xactId);

  expect(
    actualXact > expectedXact ||
      (actualXact === expectedXact && BigInt(actualCursor.cursorId) >= BigInt(expectedCursor.cursorId)),
  ).toBe(true);
}

async function seedDiscoveryCache(
  client: DbClient,
  schema: string,
  cacheKey: string,
  values: string[],
  refreshedAt: Date,
): Promise<void> {
  await client.none(
    `INSERT INTO ${qualifiedTable(schema, TABLE_DISCOVERY)} ("cacheKey", "refreshedAt", "values")
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT ("cacheKey") DO UPDATE SET
       "refreshedAt" = EXCLUDED."refreshedAt",
       "values" = EXCLUDED."values"`,
    [cacheKey, refreshedAt.toISOString(), JSON.stringify(values)],
  );
}

async function insertAllSignals(harness: DomainHarness): Promise<void> {
  await harness.domain.createSpan({
    span: makeSpan({
      traceId: 'clear-trace',
      spanId: 'clear-span',
      startedAt: dayAt(0, 8),
      endedAt: dayAt(0, 8, 0, 1),
      serviceName: 'clear-service',
    }),
  });

  await harness.domain.batchCreateMetrics({
    metrics: [makeMetric({ metricId: 'clear-metric', timestamp: dayAt(0, 8), name: 'mastra_clear_metric', value: 3 })],
  });

  await harness.domain.batchCreateLogs({
    logs: [makeLog({ logId: 'clear-log', timestamp: dayAt(0, 8), message: 'clear-log' })],
  });

  await harness.domain.createScore({
    score: makeScore({ scoreId: 'clear-score', timestamp: dayAt(0, 8), traceId: 'clear-score-trace' }),
  });

  await harness.domain.createFeedback({
    feedback: makeFeedback({ feedbackId: 'clear-feedback', timestamp: dayAt(0, 8), traceId: 'clear-feedback-trace' }),
  });
}

describe('ObservabilityStoragePostgresVNext — integration', () => {
  describe.skipIf(!integrationEnabled)('init() — TimescaleDB path', () => {
    it('detects timescaledb and reports partitionMode === "timescale"', async () => {
      const harness = await createHarness({
        connection: parseConnectionString(TIMESCALE_URL),
        schemaPrefix: 'obs_vnext_timescale_mode',
        setupDatabase: ensureTimescale,
      });

      try {
        expect(harness.domain.partitionMode).toBe('timescale');
      } finally {
        await harness.close();
      }
    });

    it('calls create_hypertable() on every signal table without throwing', async () => {
      const harness = await createHarness({
        connection: parseConnectionString(TIMESCALE_URL),
        schemaPrefix: 'obs_vnext_timescale_hypertables',
        setupDatabase: ensureTimescale,
      });

      try {
        const rows = await harness.baseClient.manyOrNone<{ hypertable_name: string }>(
          `SELECT hypertable_name
           FROM timescaledb_information.hypertables
           WHERE hypertable_schema = $1
           ORDER BY hypertable_name`,
          [harness.schema],
        );

        expect(rows.map(row => row.hypertable_name)).toEqual([...ALL_SIGNAL_TABLES].sort());
      } finally {
        await harness.close();
      }
    });
  });

  describe.skipIf(!integrationEnabled)('init() — pg_partman path', () => {
    it('detects pg_partman and reports partitionMode === "partman"', async () => {
      const harness = await createHarness({
        connection: parseConnectionString(PARTMAN_URL),
        schemaPrefix: 'obs_vnext_partman_mode',
        setupDatabase: ensurePartman,
      });

      try {
        expect(await readPartmanVersion(harness.baseClient)).toMatch(/^5\./);
        expect(harness.domain.partitionMode).toBe('partman');
      } finally {
        await harness.close();
      }
    });

    it('registers every signal table in partman.part_config', async () => {
      const harness = await createHarness({
        connection: parseConnectionString(PARTMAN_URL),
        schemaPrefix: 'obs_vnext_partman_config',
        setupDatabase: ensurePartman,
      });

      try {
        const expected = ALL_SIGNAL_TABLES.map(table => `${harness.schema}.${table}`).sort();
        const rows = await harness.baseClient.manyOrNone<{ parent_table: string }>(
          `SELECT parent_table
           FROM partman.part_config
           WHERE parent_table = ANY($1::text[])
           ORDER BY parent_table`,
          [expected],
        );

        expect(rows.map(row => row.parent_table)).toEqual(expected);
      } finally {
        await harness.close();
      }
    });

    it("routes today's writes into a partman-managed child partition", async () => {
      const harness = await createHarness({
        connection: parseConnectionString(PARTMAN_URL),
        schemaPrefix: 'obs_vnext_partman_partition',
        setupDatabase: ensurePartman,
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'partman-route-trace',
            spanId: 'partman-route-root',
            startedAt: dayAt(0, 9),
            endedAt: dayAt(0, 9, 0, 1),
          }),
        });

        const row = await harness.baseClient.one<{ partition: string }>(
          `SELECT tableoid::regclass::text AS partition
           FROM ${qualifiedTable(harness.schema, TABLE_SPAN_EVENTS)}
           WHERE "spanId" = 'partman-route-root'`,
        );

        expect(row.partition).toMatch(new RegExp(`^${harness.schema}\\.${TABLE_SPAN_EVENTS}_p`));
      } finally {
        await harness.close();
      }
    });

    it('re-running init() does not duplicate part_config rows', async () => {
      const harness = await createHarness({
        connection: parseConnectionString(PARTMAN_URL),
        schemaPrefix: 'obs_vnext_partman_reinit',
        setupDatabase: ensurePartman,
      });

      try {
        await harness.domain.init();

        const rows = await harness.baseClient.manyOrNone<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM partman.part_config
           WHERE parent_table = ANY($1::text[])`,
          [ALL_SIGNAL_TABLES.map(table => `${harness.schema}.${table}`)],
        );

        expect(Number(rows[0]?.count ?? 0)).toBe(ALL_SIGNAL_TABLES.length);
      } finally {
        await harness.close();
      }
    });
  });

  describe('init() — idempotency', () => {
    it('calling init() twice on a fresh schema does not throw', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_native_reinit',
        autoInit: false,
      });

      try {
        await expect(harness.domain.init()).resolves.toBeUndefined();
        await expect(harness.domain.init()).resolves.toBeUndefined();
      } finally {
        await harness.close();
      }
    });

    it('creates a missing configured schema on init()', async () => {
      const schema = schemaName('obs_vnext_missing_schema');
      const pool = new Pool({ connectionString, max: 2 });
      const client = new PoolAdapter(pool);
      const domain = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });

      try {
        await client.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await expect(domain.init()).resolves.toBeUndefined();

        const row = await client.one<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
           ) AS "exists"`,
          [schema],
        );
        expect(row.exists).toBe(true);
      } finally {
        await client.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await pool.end();
      }
    });

    it('a second init() after data is written leaves rows intact', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_native_reinit_data',
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'native-reinit-trace',
            spanId: 'native-reinit-root',
            startedAt: dayAt(0, 9),
            endedAt: dayAt(0, 9, 0, 1),
          }),
        });

        await harness.domain.init();

        const trace = await harness.domain.getTrace({ traceId: 'native-reinit-trace' });
        expect(trace?.spans.map(span => span.spanId)).toEqual(['native-reinit-root']);
      } finally {
        await harness.close();
      }
    });

    it('two concurrent init() calls against a fresh native schema both resolve without throwing', async () => {
      // Regression for native-partition race: CREATE TABLE IF NOT EXISTS PARTITION OF is
      // not atomic under concurrency; without isDuplicateRelationError() guard the loser
      // surfaces 42P07 "relation already exists".
      const schema = schemaName('obs_vnext_native_concurrent');
      const pool = new Pool({ connectionString, max: 4 });
      const client = new PoolAdapter(pool);

      await client.none(`CREATE SCHEMA IF NOT EXISTS ${quotedIdentifier(schema)}`);

      const first = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });
      const second = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });

      try {
        await expect(Promise.all([first.init(), second.init()])).resolves.toHaveLength(2);

        await first.createSpan({
          span: makeSpan({
            traceId: 'native-concurrent-trace',
            spanId: 'native-concurrent-root',
            startedAt: dayAt(0, 9),
            endedAt: dayAt(0, 9, 0, 1),
          }),
        });
        const trace = await second.getTrace({ traceId: 'native-concurrent-trace' });
        expect(trace?.spans.map(span => span.spanId)).toEqual(['native-concurrent-root']);
      } finally {
        await client.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await pool.end();
      }
    });

    it('two concurrent init() calls against a fresh non-existent schema both resolve without throwing', async () => {
      // Regression for the CREATE SCHEMA IF NOT EXISTS race: like
      // CREATE TABLE, it is not atomic under concurrency, and the loser
      // surfaces 42P06 duplicate_schema (or a 23505 on
      // pg_namespace_nspname_index depending on timing). isDuplicateSchemaError
      // in pg-errors.ts must swallow both.
      const schema = schemaName('obs_vnext_schema_race');
      const pool = new Pool({ connectionString, max: 4 });
      const client = new PoolAdapter(pool);

      // Intentionally do NOT pre-create the schema — both init() calls
      // must race to create it.
      const first = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });
      const second = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });

      try {
        await expect(Promise.all([first.init(), second.init()])).resolves.toHaveLength(2);

        await first.createSpan({
          span: makeSpan({
            traceId: 'schema-race-trace',
            spanId: 'schema-race-root',
            startedAt: dayAt(0, 9),
            endedAt: dayAt(0, 9, 0, 1),
          }),
        });
        const trace = await second.getTrace({ traceId: 'schema-race-trace' });
        expect(trace?.spans.map(span => span.spanId)).toEqual(['schema-race-root']);
      } finally {
        await client.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await pool.end();
      }
    });

    it('init() does not take AccessExclusiveLock on signal parent tables', async () => {
      // Regression for partition-lock-mode (M1): CREATE TABLE ... PARTITION OF
      // takes AccessExclusiveLock on the parent, which blocks every concurrent
      // read AND write against the signal table for the duration of init().
      // The fix uses CREATE TABLE (LIKE parent INCLUDING ALL) + ALTER TABLE
      // ATTACH PARTITION (ShareUpdateExclusiveLock since PG 12), which allows
      // INSERTs to continue against existing partitions in parallel.
      //
      // We assert this directly by polling pg_locks on a side connection
      // while init() runs and proving the parent signal tables are never
      // held under AccessExclusiveLock. This is unambiguous: under the old
      // CREATE TABLE PARTITION OF path the snapshot would have captured the
      // exclusive lock; under the ATTACH PARTITION path it can't.
      //
      // Force native mode so we exercise the partition creation path
      // (timescale and partman both go through their own DDL).
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_init_lock_mode',
        partitioning: { mode: 'native', futureDays: 30 },
      });

      // Use a separate connection for lock snapshots so we don't compete
      // with the init() client.
      const probePool = new Pool({ connectionString, max: 2 });
      const writer = new ObservabilityStoragePostgresVNext({
        client: harness.client,
        schemaName: harness.schema,
        // Bump futureDays so the re-init has new partitions to ATTACH and
        // actually exercises the partition-create code path under load.
        partitioning: { mode: 'native', futureDays: 90 },
      });

      const parentTables = ALL_SIGNAL_TABLES.map(table => `${harness.schema}.${table}`);

      try {
        const lockSnapshots: Array<{ relname: string; mode: string }> = [];
        let polling = true;

        const pollLocks = (async () => {
          const probe = await probePool.connect();
          try {
            while (polling) {
              const result = await probe.query<{ relname: string; mode: string }>(
                `SELECT n.nspname || '.' || c.relname AS relname, l.mode
                   FROM pg_locks l
                   JOIN pg_class c ON c.oid = l.relation
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = $1
                    AND c.relname = ANY($2::text[])
                    AND l.locktype = 'relation'
                    AND l.granted = true`,
                [harness.schema, ALL_SIGNAL_TABLES.slice()],
              );
              for (const row of result.rows) {
                lockSnapshots.push(row);
              }
              // Tight loop — we want to catch short-lived locks.
              await new Promise(resolve => setImmediate(resolve));
            }
          } finally {
            probe.release();
          }
        })();

        await writer.init();
        polling = false;
        await pollLocks;

        // The parent signal tables must never have been held under
        // AccessExclusiveLock during init(). Any other mode is fine —
        // ATTACH PARTITION takes ShareUpdateExclusiveLock, CREATE INDEX
        // takes ShareLock, regular reads take AccessShareLock, etc.
        const exclusiveOnParents = lockSnapshots.filter(
          row => row.mode === 'AccessExclusiveLock' && parentTables.includes(row.relname),
        );
        expect(exclusiveOnParents).toEqual([]);

        // Sanity-check that we actually observed *some* lock activity on
        // the parents during init(), otherwise the test might pass because
        // the poll missed every window.
        const observedOnParents = lockSnapshots.filter(row => parentTables.includes(row.relname));
        expect(observedOnParents.length).toBeGreaterThan(0);
      } finally {
        await probePool.end();
        await harness.close();
      }
    });
  });

  describe('page-mode pagination ordering', () => {
    it('adds cursorId as a stable tie-breaker for signals, traces, and branches', async () => {
      const selectQueries: string[] = [];
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_page_order',
        wrapClient: client =>
          wrapClient(client, {
            manyOrNone: async (query: string, values?: QueryValues) => {
              if (query.includes('ORDER BY') && query.includes('LIMIT') && query.includes('OFFSET')) {
                selectQueries.push(query.replace(/\s+/g, ' ').trim());
              }
              return client.manyOrNone(query, values);
            },
          }),
      });

      try {
        const timestamp = dayAt(0, 8);
        await harness.domain.batchCreateLogs({
          logs: [
            makeLog({ logId: 'page-order-log-a', timestamp, message: 'a' }),
            makeLog({ logId: 'page-order-log-b', timestamp, message: 'b' }),
          ],
        });
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'page-order-trace-a',
            spanId: 'page-order-trace-a',
            spanType: SpanType.AGENT_RUN,
            startedAt: timestamp,
            endedAt: new Date(timestamp.getTime() + 1),
          }),
        });
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'page-order-trace-b',
            spanId: 'page-order-trace-b',
            spanType: SpanType.AGENT_RUN,
            startedAt: timestamp,
            endedAt: new Date(timestamp.getTime() + 1),
          }),
        });

        await harness.domain.listLogs({
          mode: 'page',
          pagination: { page: 0, perPage: 1 },
          orderBy: { field: 'timestamp', direction: 'ASC' },
        });
        await harness.domain.listTraces({
          mode: 'page',
          pagination: { page: 0, perPage: 1 },
          orderBy: { field: 'startedAt', direction: 'ASC' },
        });
        await harness.domain.listBranches({
          mode: 'page',
          pagination: { page: 0, perPage: 1 },
          orderBy: { field: 'startedAt', direction: 'ASC' },
        });

        expect(selectQueries).toHaveLength(3);
        expect(selectQueries[0]).toContain('ORDER BY "timestamp" ASC, "cursorId" ASC');
        expect(selectQueries[1]).toContain('ORDER BY r."startedAt" ASC, r."cursorId" ASC');
        expect(selectQueries[2]).toContain('ORDER BY r."startedAt" ASC, r."cursorId" ASC');
      } finally {
        await harness.close();
      }
    });
  });

  describe('dangerouslyClearAll() — post-condition', () => {
    it('truncates every signal table and the discovery cache table', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_clear_counts',
      });

      try {
        await insertAllSignals(harness);
        await harness.domain.getServiceNames({});

        await harness.domain.dangerouslyClearAll();

        for (const table of [...ALL_SIGNAL_TABLES, TABLE_DISCOVERY]) {
          expect(await countRows(harness.baseClient, harness.schema, table)).toBe(0);
        }
      } finally {
        await harness.close();
      }
    });

    it('leaves the schema, indexes, and cursor sequences in place', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_clear_schema',
      });

      try {
        await insertAllSignals(harness);
        await harness.domain.dangerouslyClearAll();

        for (const table of [...ALL_SIGNAL_TABLES, TABLE_DISCOVERY]) {
          const relation = await harness.baseClient.one<{ regclass: string | null }>(
            `SELECT to_regclass($1)::text AS regclass`,
            [`${harness.schema}.${table}`],
          );
          expect(relation.regclass).toBe(`${harness.schema}.${table}`);
        }

        for (const table of ALL_SIGNAL_TABLES) {
          const sequence = await harness.baseClient.one<{ seq: string | null }>(
            `SELECT pg_get_serial_sequence($1, 'cursorId') AS seq`,
            [`${harness.schema}.${table}`],
          );
          expect(sequence.seq).toContain(`${table}_cursorId_seq`);

          const indexes = await harness.baseClient.one<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM pg_indexes
             WHERE schemaname = $1 AND tablename = $2`,
            [harness.schema, table],
          );
          expect(Number(indexes.count)).toBeGreaterThan(0);
        }
      } finally {
        await harness.close();
      }
    });
  });

  describe('discovery — cold-start dedupe', () => {
    it('N concurrent first-callers share one refresh and see the same values', async () => {
      let refreshCount = 0;
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_discovery_cold',
        wrapClient: client =>
          wrapClient(client, {
            manyOrNone: async (query: string, values?: QueryValues) => {
              if (query.includes('SELECT v FROM (') && query.includes('"serviceName" AS v')) {
                refreshCount += 1;
              }
              return client.manyOrNone(query, values);
            },
          }),
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'discovery-cold-trace',
            spanId: 'discovery-cold-root',
            serviceName: 'shared-service',
            startedAt: dayAt(0, 9),
            endedAt: dayAt(0, 9, 0, 1),
          }),
        });

        const results = await Promise.all(Array.from({ length: 8 }, () => harness.domain.getServiceNames({})));
        expect(refreshCount).toBe(1);
        expect(results.map(result => result.serviceNames)).toEqual(Array.from({ length: 8 }, () => ['shared-service']));
      } finally {
        await harness.close();
      }
    });
  });

  describe('discovery — stale SWR', () => {
    it('returns stale cached values immediately and refreshes them in the background', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_discovery_stale',
        discovery: { ttlSeconds: 1 },
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'discovery-stale-trace',
            spanId: 'discovery-stale-root',
            serviceName: 'fresh-service',
            startedAt: dayAt(0, 10),
            endedAt: dayAt(0, 10, 0, 1),
          }),
        });

        const oldRefreshedAt = new Date(Date.now() - 60_000);
        await seedDiscoveryCache(
          harness.baseClient,
          harness.schema,
          'service_names',
          ['stale-service'],
          oldRefreshedAt,
        );

        const first = await harness.domain.getServiceNames({});
        expect(first.serviceNames).toEqual(['stale-service']);

        await vi.waitFor(async () => {
          const row = await harness.baseClient.one<{ values: string[]; refreshedAt: Date }>(
            `SELECT "values", "refreshedAt" FROM ${qualifiedTable(harness.schema, TABLE_DISCOVERY)} WHERE "cacheKey" = 'service_names'`,
          );
          expect(row.values).toEqual(['fresh-service']);
          expect(new Date(row.refreshedAt).getTime()).toBeGreaterThan(oldRefreshedAt.getTime());
        });
      } finally {
        await harness.close();
      }
    });

    it('a second stale call within the in-flight window does not start a new refresh', async () => {
      let refreshCount = 0;
      let resolveRefresh: (() => void) | undefined;
      const refreshGate = new Promise<void>(resolve => {
        resolveRefresh = resolve;
      });

      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_discovery_inflight',
        discovery: { ttlSeconds: 1 },
        wrapClient: client =>
          wrapClient(client, {
            manyOrNone: async (query: string, values?: QueryValues) => {
              if (query.includes('SELECT v FROM (') && query.includes('"serviceName" AS v')) {
                refreshCount += 1;
                await refreshGate;
              }
              return client.manyOrNone(query, values);
            },
          }),
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'discovery-inflight-trace',
            spanId: 'discovery-inflight-root',
            serviceName: 'fresh-service',
            startedAt: dayAt(0, 10),
            endedAt: dayAt(0, 10, 0, 1),
          }),
        });

        await seedDiscoveryCache(
          harness.baseClient,
          harness.schema,
          'service_names',
          ['stale-service'],
          new Date(Date.now() - 60_000),
        );

        const first = await harness.domain.getServiceNames({});
        const second = await harness.domain.getServiceNames({});

        expect(first.serviceNames).toEqual(['stale-service']);
        expect(second.serviceNames).toEqual(['stale-service']);
        expect(refreshCount).toBe(1);

        resolveRefresh?.();

        await vi.waitFor(async () => {
          const row = await harness.baseClient.one<{ values: string[] }>(
            `SELECT "values" FROM ${qualifiedTable(harness.schema, TABLE_DISCOVERY)} WHERE "cacheKey" = 'service_names'`,
          );
          expect(row.values).toEqual(['fresh-service']);
        });
      } finally {
        await harness.close();
      }
    });
  });

  describe('discovery — refresh failure surfaces', () => {
    it('routes refresh failures to the framework logger and the next reader retries', async () => {
      let refreshAttempts = 0;
      const warn = vi.fn();

      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_discovery_failure',
        discovery: { ttlSeconds: 1 },
        wrapClient: client =>
          wrapClient(client, {
            manyOrNone: async (query: string, values?: QueryValues) => {
              if (query.includes('SELECT v FROM (') && query.includes('"serviceName" AS v')) {
                refreshAttempts += 1;
                if (refreshAttempts === 1) {
                  throw new Error('boom');
                }
              }
              return client.manyOrNone(query, values);
            },
          }),
      });

      // Inject a mock logger so we can assert on logger.warn directly
      // instead of the underlying console.* sink. The domain reads
      // `this.logger` lazily when building the discovery config, so
      // __setLogger flows through to the discovery helpers.
      harness.domain.__setLogger({
        debug: vi.fn(),
        info: vi.fn(),
        warn,
        error: vi.fn(),
        trackException: vi.fn(),
        getLogs: vi.fn(),
        getLogsByRunId: vi.fn(),
      } as any);

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'discovery-failure-trace',
            spanId: 'discovery-failure-root',
            serviceName: 'fresh-service',
            startedAt: dayAt(0, 10),
            endedAt: dayAt(0, 10, 0, 1),
          }),
        });

        await seedDiscoveryCache(
          harness.baseClient,
          harness.schema,
          'service_names',
          ['stale-service'],
          new Date(Date.now() - 60_000),
        );

        const first = await harness.domain.getServiceNames({});
        expect(first.serviceNames).toEqual(['stale-service']);

        await vi.waitFor(() => {
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('background refresh failed for discovery cache key "service_names"'),
            expect.objectContaining({ error: expect.any(Error) }),
          );
        });

        const second = await harness.domain.getServiceNames({});
        expect(second.serviceNames).toEqual(['stale-service']);

        await vi.waitFor(async () => {
          const row = await harness.baseClient.one<{ values: string[] }>(
            `SELECT "values" FROM ${qualifiedTable(harness.schema, TABLE_DISCOVERY)} WHERE "cacheKey" = 'service_names'`,
          );
          expect(refreshAttempts).toBe(2);
          expect(row.values).toEqual(['fresh-service']);
        });
      } finally {
        await harness.close();
      }
    });
  });

  describe('OLAP — percentile golden values', () => {
    it('getMetricPercentiles returns exact percentile_cont values', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_metric_percentiles',
      });

      try {
        await harness.domain.batchCreateMetrics({
          metrics: Array.from({ length: 100 }, (_, index) =>
            makeMetric({
              metricId: `pctl-${index + 1}`,
              timestamp: dayAt(0, 12, index % 10),
              name: 'mastra_percentile_metric',
              value: index + 1,
            }),
          ),
        });

        const result = await harness.domain.getMetricPercentiles({
          name: 'mastra_percentile_metric',
          interval: '1h',
          percentiles: [0.5, 0.9, 0.95, 0.99],
        });

        const values = Object.fromEntries(
          result.series.map(series => [series.percentile, series.points[0]?.value ?? null]),
        ) as Record<number, number | null>;

        expect(values[0.5]).toBeCloseTo(50.5, 10);
        expect(values[0.9]).toBeCloseTo(90.1, 10);
        expect(values[0.95]).toBeCloseTo(95.05, 10);
        expect(values[0.99]).toBeCloseTo(99.01, 10);
      } finally {
        await harness.close();
      }
    });
  });

  describe('PostgresStoreVNext — collision warning', () => {
    it('warns when observability shares the primary connectionString', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const store = new PostgresStoreVNext({
        id: 'collision-conn-string',
        connectionString,
        observability: { connectionString },
      });

      try {
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        await store.close();
      }
    });

    it('warns when observability shares the primary pool instance', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const pool = new Pool({ connectionString, max: 2 });
      const store = new PostgresStoreVNext({
        id: 'collision-pool',
        pool,
        observability: { pool },
      });

      try {
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        await store.close();
      }
    });

    it('warns when observability shares the primary host+port+database', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const hostConfig = TEST_CONFIG as {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
      };
      const store = new PostgresStoreVNext({
        ...TEST_CONFIG,
        id: 'collision-host',
        observability: {
          host: hostConfig.host,
          port: hostConfig.port,
          database: hostConfig.database,
          user: hostConfig.user,
          password: hostConfig.password,
        },
      });

      try {
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        await store.close();
      }
    });

    it('does NOT warn when observability points at a different target', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const store = new PostgresStoreVNext({
        ...TEST_CONFIG,
        id: 'collision-none',
        observability: {
          host: defaultConnection.host,
          port: defaultConnection.port + 100,
          database: `${defaultConnection.database}_other`,
          user: defaultConnection.user,
          password: defaultConnection.password,
        },
      });

      try {
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        await store.close();
      }
    });
  });

  describe('delta polling — monotonic across partitions / chunks', () => {
    it('does not skip a lower cursorId that commits after a higher cursorId', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_delta_xact',
      });
      const txA = await harness.baseClient.connect();
      const txB = await harness.baseClient.connect();
      let txAReleased = false;
      let txBReleased = false;

      try {
        await withDeltaPolling(async () => {
          const table = qualifiedTable(harness.schema, TABLE_LOG_EVENTS);

          await txA.query('BEGIN');
          await txA.query(
            `INSERT INTO ${table} ("logId", "timestamp", "level", "message")
             VALUES ($1, $2, $3, $4)`,
            ['delta-xact-a', dayAt(0, 8).toISOString(), 'info', 'lower cursor commits last'],
          );

          await txB.query('BEGIN');
          await txB.query(
            `INSERT INTO ${table} ("logId", "timestamp", "level", "message")
             VALUES ($1, $2, $3, $4)`,
            ['delta-xact-b', dayAt(0, 8, 0, 1).toISOString(), 'info', 'higher cursor commits first'],
          );
          await txB.query('COMMIT');
          txB.release();
          txBReleased = true;

          const heldBack = await harness.domain.listLogs({ mode: 'delta', after: '0:0', limit: 10 });
          expect(heldBack.logs).toEqual([]);

          await txA.query('COMMIT');
          txA.release();
          txAReleased = true;

          const caughtUp = await harness.domain.listLogs({ mode: 'delta', after: heldBack.deltaCursor, limit: 10 });
          expect(caughtUp.logs.map(log => log.logId).sort()).toEqual(['delta-xact-a', 'delta-xact-b']);

          const next = await harness.domain.listLogs({ mode: 'delta', after: caughtUp.deltaCursor, limit: 10 });
          expect(next.logs).toEqual([]);
        });
      } finally {
        if (!txAReleased) {
          try {
            await txA.query('ROLLBACK');
          } catch {
            // The transaction may already be committed.
          }
          txA.release();
        }
        if (!txBReleased) {
          try {
            await txB.query('ROLLBACK');
          } catch {
            // The transaction may already be committed.
          }
          txB.release();
        }
        await harness.close();
      }
    });

    it('every inserted root span surfaces exactly once across native-partition delta polls', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_delta_native',
      });

      try {
        await withDeltaPolling(async () => {
          const spans = [
            makeSpan({
              traceId: 'delta-native-a',
              spanId: 'delta-native-a',
              startedAt: dayAt(0, 8),
              endedAt: dayAt(0, 8, 0, 1),
            }),
            makeSpan({
              traceId: 'delta-native-b',
              spanId: 'delta-native-b',
              startedAt: dayAt(0, 9),
              endedAt: dayAt(0, 9, 0, 1),
            }),
            makeSpan({
              traceId: 'delta-native-c',
              spanId: 'delta-native-c',
              startedAt: dayAt(1, 8),
              endedAt: dayAt(1, 8, 0, 1),
            }),
            makeSpan({
              traceId: 'delta-native-d',
              spanId: 'delta-native-d',
              startedAt: dayAt(1, 9),
              endedAt: dayAt(1, 9, 0, 1),
            }),
          ];

          for (const span of spans) {
            await harness.domain.createSpan({ span });
          }

          const seen = new Set<string>();
          let cursor = '0:0';
          let hasMore = true;

          while (hasMore) {
            const page = await harness.domain.listTraces({ mode: 'delta', after: cursor, limit: 2 });
            page.spans.forEach(span => seen.add(span.spanId));
            expectCursorAtOrAfter(page.deltaCursor, cursor);
            cursor = page.deltaCursor;
            hasMore = page.delta?.hasMore ?? false;
            if (!hasMore && page.spans.length === 0) {
              break;
            }
          }

          expect([...seen].sort()).toEqual(['delta-native-a', 'delta-native-b', 'delta-native-c', 'delta-native-d']);
        });
      } finally {
        await harness.close();
      }
    });
  });

  describe('partition routing', () => {
    it("today's row lands in the native daily child partition", async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_partition_route',
      });

      try {
        await harness.domain.createSpan({
          span: makeSpan({
            traceId: 'partition-route-trace',
            spanId: 'partition-route-span',
            startedAt: dayAt(0, 13),
            endedAt: dayAt(0, 13, 0, 1),
          }),
        });

        const row = await harness.baseClient.one<{ partition: string }>(
          `SELECT tableoid::regclass::text AS partition
           FROM ${qualifiedTable(harness.schema, TABLE_SPAN_EVENTS)}
           WHERE "spanId" = 'partition-route-span'`,
        );

        expect(row.partition).toBe(`${harness.schema}.${TABLE_SPAN_EVENTS}_p${yyyymmdd(dayAt(0))}`);
      } finally {
        await harness.close();
      }
    });

    it.skipIf(!integrationEnabled)("partitioning.mode: 'native' overrides auto-detected Timescale", async () => {
      const harness = await createHarness({
        connection: parseConnectionString(TIMESCALE_URL),
        schemaPrefix: 'obs_vnext_native_override',
        setupDatabase: ensureTimescale,
        partitioning: { mode: 'native' },
      });

      try {
        expect(harness.domain.partitionMode).toBe('native');

        const row = await harness.baseClient.one<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM timescaledb_information.hypertables
           WHERE hypertable_schema = $1`,
          [harness.schema],
        );

        expect(Number(row.count)).toBe(0);
      } finally {
        await harness.close();
      }
    });
  });

  describe('ON CONFLICT DO NOTHING — retry idempotency', () => {
    it('createSpan twice with the same key inserts exactly one row', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_retry_span',
      });

      try {
        const span = makeSpan({
          traceId: 'retry-span-trace',
          spanId: 'retry-span-id',
          startedAt: dayAt(0, 14),
          endedAt: dayAt(0, 14, 0, 1),
        });

        await harness.domain.createSpan({ span });
        await harness.domain.createSpan({ span });

        expect(await countRows(harness.baseClient, harness.schema, TABLE_SPAN_EVENTS)).toBe(1);
      } finally {
        await harness.close();
      }
    });

    it('batchCreateSpans dedupes repeated records', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_retry_batch_span',
      });

      try {
        const span = makeSpan({
          traceId: 'retry-batch-trace',
          spanId: 'retry-batch-id',
          startedAt: dayAt(0, 15),
          endedAt: dayAt(0, 15, 0, 1),
        });

        await harness.domain.batchCreateSpans({ records: [span] });
        await harness.domain.batchCreateSpans({ records: [span] });

        expect(await countRows(harness.baseClient, harness.schema, TABLE_SPAN_EVENTS)).toBe(1);
      } finally {
        await harness.close();
      }
    });
  });

  describe('dangerouslyClearAll — cursorId sequence resets', () => {
    it('after clearAll, the next inserted row has cursorId === 1', async () => {
      const harness = await createHarness({
        schemaPrefix: 'obs_vnext_cursor_reset',
      });

      try {
        await harness.domain.batchCreateLogs({
          logs: [makeLog({ logId: 'cursor-reset-first', timestamp: dayAt(0, 16), message: 'first' })],
        });

        await harness.domain.dangerouslyClearAll();

        await harness.domain.batchCreateLogs({
          logs: [makeLog({ logId: 'cursor-reset-second', timestamp: dayAt(0, 16, 1), message: 'second' })],
        });

        expect(
          await readCursorId(harness.baseClient, harness.schema, TABLE_LOG_EVENTS, 'logId', 'cursor-reset-second'),
        ).toBe(1);
      } finally {
        await harness.close();
      }
    });
  });

  describe.skipIf(!integrationEnabled)('pg_partman — concurrent init', () => {
    it('two concurrent init() calls both resolve without throwing and keep one config row per signal', async () => {
      const connection = parseConnectionString(PARTMAN_URL);
      const pool = new Pool({ connectionString: connection.connectionString, max: 2 });
      const client = new PoolAdapter(pool);
      const schema = schemaName('obs_vnext_partman_concurrent');

      await client.none(`CREATE SCHEMA IF NOT EXISTS ${quotedIdentifier(schema)}`);
      await ensurePartman(client);

      const first = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });
      const second = new ObservabilityStoragePostgresVNext({ client, schemaName: schema });

      try {
        await expect(Promise.all([first.init(), second.init()])).resolves.toHaveLength(2);

        const row = await client.one<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM partman.part_config
           WHERE parent_table = ANY($1::text[])`,
          [ALL_SIGNAL_TABLES.map(table => `${schema}.${table}`)],
        );

        expect(Number(row.count)).toBe(ALL_SIGNAL_TABLES.length);
      } finally {
        await client.none(`DROP SCHEMA IF EXISTS ${quotedIdentifier(schema)} CASCADE`);
        await pool.end();
      }
    });
  });

  describe('pg_partman — deadlock recovery', () => {
    it('re-checks part_config with quoted parent_table formatting after a deadlock', async () => {
      const recoveryChecks: Array<{ query: string; values?: QueryValues }> = [];
      let deadlockThrown = false;
      let recoveryChecked = false;
      let createCalls = 0;

      const client = {
        oneOrNone: vi.fn(async (query: string, values?: QueryValues) => {
          if (query.includes('extversion')) return { extversion: '5.0.0' };
          if (!query.includes('partman.part_config')) return null;

          if (deadlockThrown && !recoveryChecked) {
            recoveryChecked = true;
            recoveryChecks.push({ query, values });
            return { exists: true };
          }

          return { exists: false };
        }),
        none: vi.fn(async () => {
          createCalls += 1;
          if (!deadlockThrown) {
            deadlockThrown = true;
            throw new Error('deadlock detected');
          }
        }),
      } as unknown as DbClient;

      await expect(ensurePartmanHypertables(client, 'Needs Quote')).resolves.toBeUndefined();

      expect(createCalls).toBeGreaterThan(0);
      expect(recoveryChecks).toHaveLength(1);
      expect(recoveryChecks[0]!.query).toContain(`parent_table = format('%I.%I', $1::text, $2::text)`);
      expect(recoveryChecks[0]!.values).toEqual(['Needs Quote', TABLE_SPAN_EVENTS]);
    });
  });
});
