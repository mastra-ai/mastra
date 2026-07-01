import {
  createTestSuite,
  createClientAcceptanceTests,
  createConfigValidationTests,
  createDomainDirectTests,
  createStoreIndexTests,
  createDomainIndexTests,
} from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_THREADS } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Pool } from 'pg';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';

import { DatasetsPG } from './domains/datasets';
import { ExperimentsPG } from './domains/experiments';
import { MemoryPG } from './domains/memory';
import { ScoresPG } from './domains/scores';
import { WorkflowsPG } from './domains/workflows';
import { pgTests, TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

createTestSuite(new PostgresStore(TEST_CONFIG));
createTestSuite(new PostgresStore({ ...TEST_CONFIG, schemaName: 'my_schema' }));

// Helper to create a pre-configured pg.Pool
const createTestPool = () => {
  return new Pool({ connectionString });
};

// Pre-configured pool acceptance tests
createClientAcceptanceTests({
  storeName: 'PostgresStore',
  expectedStoreName: 'PostgresStore',
  createStoreWithClient: () => {
    const pool = createTestPool();
    return new PostgresStore({
      id: 'pg-pool-test',
      pool,
    });
  },
});

// Domain-level pre-configured pool tests
createDomainDirectTests({
  storeName: 'PostgreSQL',
  createMemoryDomain: () => {
    const pool = createTestPool();
    return new MemoryPG({ pool });
  },
  createWorkflowsDomain: () => {
    const pool = createTestPool();
    return new WorkflowsPG({ pool });
  },
  createScoresDomain: () => {
    const pool = createTestPool();
    return new ScoresPG({ pool });
  },
  createDatasetsDomain: () => {
    const pool = createTestPool();
    return new DatasetsPG({ pool });
  },
  createExperimentsDomain: () => {
    const pool = createTestPool();
    return new ExperimentsPG({ pool });
  },
});

// Configuration validation tests
createConfigValidationTests({
  storeName: 'PostgresStore',
  createStore: config => new PostgresStore(config as any),
  validConfigs: [
    {
      description: 'valid host-based config',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      },
    },
    {
      description: 'valid connection string',
      config: { id: 'test-store', connectionString: 'postgresql://user:pass@localhost/db' },
    },
    {
      description: 'config with schemaName',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'connectionString with schemaName',
      config: {
        id: 'test-store',
        connectionString: 'postgresql://user:pass@localhost/db',
        schemaName: 'custom_schema',
      },
    },
    {
      description: 'pre-configured pg.Pool',
      config: { id: 'test-store', pool: createTestPool() },
    },
    {
      description: 'pool with schemaName',
      config: { id: 'test-store', pool: createTestPool(), schemaName: 'custom_schema' },
    },
    {
      description: 'disableInit with host config',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        disableInit: true,
      },
    },
    {
      description: 'disableInit with pool',
      config: { id: 'test-store', pool: createTestPool(), disableInit: true },
    },
    {
      description: 'connectionString with ssl: true',
      config: { id: 'test-store', connectionString: 'postgresql://user:pass@localhost/db', ssl: true },
    },
    {
      description: 'host config with ssl object',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      description: 'host config with pool options',
      config: {
        id: 'test-store',
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        max: 30,
        idleTimeoutMillis: 60000,
      },
    },
  ],
  invalidConfigs: [
    {
      description: 'empty connectionString',
      config: { id: 'test-store', connectionString: '' },
      expectedError: /connectionString must be provided and cannot be empty/i,
    },
    {
      description: 'empty host',
      config: { id: 'test-store', host: '', port: 5432, database: 'test', user: 'test', password: 'test' },
      expectedError: /host must be provided/i,
    },
    {
      description: 'empty database',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: '', user: 'test', password: 'test' },
      expectedError: /database must be provided/i,
    },
    {
      description: 'empty user',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: 'test', user: '', password: 'test' },
      expectedError: /user must be provided/i,
    },
    {
      description: 'empty password',
      config: { id: 'test-store', host: 'localhost', port: 5432, database: 'test', user: 'test', password: '' },
      expectedError: /password must be provided/i,
    },
    {
      description: 'missing required fields',
      config: { id: 'test-store', user: 'test' },
      expectedError: /invalid config.*Provide either.*pool.*connectionString.*host/i,
    },
    {
      description: 'completely empty config',
      config: { id: 'test-store' },
      expectedError: /invalid config.*Provide either.*pool.*connectionString.*host/i,
    },
  ],
});

// PG-specific tests (public fields, table quoting, permissions, function namespace, timestamp fallback, Cloud SQL, etc.)
pgTests();

// Helper to check if a PostgreSQL index exists in a specific schema
const pgIndexExists = async (store: PostgresStore, namePattern: string): Promise<boolean> => {
  // PostgresStore exposes schema through .schema property
  const schemaName = (store as any).schema || 'public';
  const result = await store.db.oneOrNone<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname ILIKE $2) AS exists`,
    [schemaName, `%${namePattern}%`],
  );
  return result?.exists === true;
};

// Store-level index configuration tests
// Uses unique schema names to avoid index collision between tests
const storeTestId = Math.floor(Date.now() / 1000) % 100000; // Short unique ID
createStoreIndexTests({
  storeName: 'PostgresStore',
  createDefaultStore: () =>
    new PostgresStore({ ...TEST_CONFIG, id: 'pg-idx-default', schemaName: `idx_s_${storeTestId}_d` }),
  createStoreWithSkipDefaults: () =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-skip',
      schemaName: `idx_s_${storeTestId}_s`,
      skipDefaultIndexes: true,
    }),
  createStoreWithCustomIndexes: indexes =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-custom',
      schemaName: `idx_s_${storeTestId}_c`,
      indexes: indexes as any,
    }),
  createStoreWithInvalidTable: indexes =>
    new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-idx-invalid',
      schemaName: `idx_s_${storeTestId}_i`,
      indexes: indexes as any,
    }),
  indexExists: (store, pattern) => pgIndexExists(store as PostgresStore, pattern),
  defaultIndexPattern: 'threads_resourceid_createdat',
  customIndexName: 'custom_pg_test_idx',
  customIndexDef: {
    name: 'custom_pg_test_idx',
    table: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_table_idx',
    table: 'nonexistent_table_xyz',
    columns: ['id'],
  },
});

// Domain-level index configuration tests (using MemoryPG as representative)
// Uses unique schema names to avoid index collision between tests
const domainTestId = (Math.floor(Date.now() / 1000) % 100000) + 1; // Short unique ID (different from store)
let currentDomainTestSchema = '';

createDomainIndexTests({
  domainName: 'MemoryPG',
  createDefaultDomain: () => {
    currentDomainTestSchema = `idx_d_${domainTestId}_d`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema });
  },
  createDomainWithSkipDefaults: () => {
    currentDomainTestSchema = `idx_d_${domainTestId}_s`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, skipDefaultIndexes: true });
  },
  createDomainWithCustomIndexes: indexes => {
    currentDomainTestSchema = `idx_d_${domainTestId}_c`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
  },
  createDomainWithInvalidTable: indexes => {
    currentDomainTestSchema = `idx_d_${domainTestId}_i`;
    const pool = createTestPool();
    return new MemoryPG({ pool, schemaName: currentDomainTestSchema, indexes: indexes as any });
  },
  indexExists: async (_domain, pattern) => {
    // Create a fresh pool to check indexes
    const pool = createTestPool();
    try {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname ILIKE $2) AS exists`,
        [currentDomainTestSchema, `%${pattern}%`],
      );
      return result.rows[0]?.exists === true;
    } finally {
      await pool.end();
    }
  },
  defaultIndexPattern: 'threads_resourceid_createdat',
  customIndexName: 'custom_memory_test_idx',
  customIndexDef: {
    name: 'custom_memory_test_idx',
    table: TABLE_THREADS,
    columns: ['title'],
  },
  invalidTableIndexDef: {
    name: 'invalid_domain_table_idx',
    table: 'nonexistent_table_xyz',
    columns: ['id'],
  },
});

describe('MemoryPG error propagation (no empty-on-error)', () => {
  // These reads used to swallow DB errors and return an empty page, so an outage
  // looked exactly like "no data". They should throw instead.
  const createFailingDomain = () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('simulated backend outage')) };
    return new MemoryPG({ pool: pool as any });
  };

  // Also check the cause is the original error, so a broken mock can't pass as
  // a real outage.
  const expectOutage = async (promise: Promise<unknown>, idPattern: RegExp) => {
    const err: any = await promise.then(
      () => {
        throw new Error('expected the read to reject, but it resolved');
      },
      e => e,
    );
    expect(err).toMatchObject({ id: expect.stringMatching(idPattern) });
    expect(String(err?.cause?.message ?? err?.message)).toContain('simulated backend outage');
  };

  it('listThreads re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listThreads({}), /LIST_THREADS.*FAILED/);
  });

  it('listMessages re-throws backend failures instead of returning empty', async () => {
    await expectOutage(createFailingDomain().listMessages({ threadId: 'thread-err' }), /LIST_MESSAGES.*FAILED/);
  });

  it('listMessagesByResourceId re-throws backend failures instead of returning empty', async () => {
    await expectOutage(
      createFailingDomain().listMessagesByResourceId({ resourceId: 'res-err' }),
      /LIST_MESSAGES_BY_RESOURCE_ID.*FAILED/,
    );
  });
});

// Pool integration tests
describe('PostgresStore pool integration', () => {
  it('should expose the same pool instance that was passed in', async () => {
    const pool = createTestPool();
    const store = new PostgresStore({ id: 'pool-test', pool });
    expect(store.pool).toBe(pool);
    await pool.end();
  });

  it('should not close a passed-in pool when close() is called', async () => {
    const pool = createTestPool();
    const store = new PostgresStore({ id: 'shared-pool-test', pool });

    await store.close();

    // Pool should still be usable after store.close()
    const result = await pool.query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);

    await pool.end();
  });

  it('should close pool when close() is called on internally-created pool', async () => {
    const store = new PostgresStore({
      id: 'close-test',
      connectionString,
    });

    expect(store.pool).toBeDefined();
    await store.close();

    // Pool should be closed now
    await expect(store.pool.query('SELECT 1')).rejects.toThrow();
  });
});

describe('WorkflowsPG snapshot sanitization', () => {
  it('round-trips workflow-executed backslash content and strips null characters', async () => {
    const pool = createTestPool();
    const store = new PostgresStore({ id: `pg-sanitize-${Date.now()}`, pool });
    const workflowName = `sanitize-roundtrip-${Date.now()}`;
    const runId = `run-${Date.now()}`;

    const captureStep = createStep({
      id: 'capture-special-strings',
      inputSchema: z.object({
        invalidEscapeV: z.string(),
        invalidEscapeK: z.string(),
        backslashSpace: z.string(),
        validEscape: z.string(),
        nullCharContent: z.string(),
      }),
      outputSchema: z.object({
        invalidEscapeV: z.string(),
        invalidEscapeK: z.string(),
        backslashSpace: z.string(),
        validEscape: z.string(),
        nullCharContent: z.string(),
      }),
      execute: async ({ inputData }) => inputData,
    });

    const workflow = createWorkflow({
      id: workflowName,
      inputSchema: z.object({
        invalidEscapeV: z.string(),
        invalidEscapeK: z.string(),
        backslashSpace: z.string(),
        validEscape: z.string(),
        nullCharContent: z.string(),
      }),
      outputSchema: z.object({
        invalidEscapeV: z.string(),
        invalidEscapeK: z.string(),
        backslashSpace: z.string(),
        validEscape: z.string(),
        nullCharContent: z.string(),
      }),
    })
      .then(captureStep)
      .commit();

    const inputData = {
      invalidEscapeV: 'Omschr\\vijving',
      invalidEscapeK: 'Toepassel\\k',
      backslashSpace: 'hello\\ world',
      validEscape: 'line1\nline2',
      nullCharContent: 'prefix\u0000suffix',
    };

    try {
      await store.init();

      const mastra = new Mastra({
        logger: false,
        storage: store,
        workflows: { [workflowName]: workflow },
      });

      workflow.__registerMastra(mastra);

      const run = await workflow.createRun({ runId });
      const result = await run.start({ inputData });

      expect(result.status).toBe('success');
      expect(result.steps['capture-special-strings']).toMatchObject({
        status: 'success',
        output: {
          invalidEscapeV: 'Omschr\\vijving',
          invalidEscapeK: 'Toepassel\\k',
          backslashSpace: 'hello\\ world',
          validEscape: 'line1\nline2',
          nullCharContent: 'prefix\u0000suffix',
        },
      });

      const workflows = await store.getStore('workflows');
      const loadedSnapshot = await workflows?.loadWorkflowSnapshot({ workflowName, runId });
      expect(loadedSnapshot).toBeDefined();
      expect((loadedSnapshot as any)?.context['capture-special-strings']).toMatchObject({
        status: 'success',
        output: {
          invalidEscapeV: 'Omschr\\vijving',
          invalidEscapeK: 'Toepassel\\k',
          backslashSpace: 'hello\\ world',
          validEscape: 'line1\nline2',
          nullCharContent: 'prefixsuffix',
        },
      });

      const { runs } = await workflows!.listWorkflowRuns({ workflowName, status: 'success' });
      const storedRun = runs.find(run => run.runId === runId);
      expect(storedRun).toBeDefined();
      expect((storedRun?.snapshot as any)?.context['capture-special-strings']).toMatchObject({
        status: 'success',
        output: {
          invalidEscapeV: 'Omschr\\vijving',
          invalidEscapeK: 'Toepassel\\k',
          backslashSpace: 'hello\\ world',
          validEscape: 'line1\nline2',
          nullCharContent: 'prefixsuffix',
        },
      });
    } finally {
      await pool.end();
    }
  });
});

/**
 * Real-Postgres regression for https://github.com/mastra-ai/mastra/issues/17679
 *
 * The simulation tests in packages/core prove the architectural shape
 * of the bug — that MastraCompositeStore.init() broadcasts DDL across
 * the pool via Promise.all. These tests prove the same bug exhibits on
 * an actual `pg.Pool` against an actual Postgres instance under
 * Supabase-shaped constraints (tight pool budget, tight statement
 * timeout), and that the fix resolves it end-to-end.
 *
 * Each test uses a unique `schemaName` so it runs in isolation against
 * the shared `pg-test-db` container and never interferes with the
 * baseline `createTestSuite(...)` runs above.
 */
describe('PostgresStore.init() — parallel DDL fan-out (issue #17679)', () => {
  /** Best-effort isolation: each test runs against its own schema. */
  async function dropSchema(schemaName: string) {
    try {
      const cleanup = new Pool({ connectionString });
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await cleanup.end();
    } catch {}
  }

  /**
   * Instruments a Pool to observe init-time fan-out. Tracks:
   *   - totalQueries / peakInFlight: concurrent `pool.query()` calls
   *   - totalConnects / peakClientsCheckedOut: concurrent `pool.connect()`
   *     checkouts (the underlying resource a transaction pooler bills)
   *
   * Both metrics are needed because different fixes show up in different
   * places: per-statement serialization shows up in `pool.query()`, while
   * pinning all DDL to one backend shows up as a single `pool.connect()`
   * with zero `pool.query()` traffic.
   */
  function instrumentPool(pool: Pool) {
    const state = {
      inFlight: 0,
      peakInFlight: 0,
      totalQueries: 0,
      checkedOut: 0,
      peakClientsCheckedOut: 0,
      totalConnects: 0,
    };

    const originalQuery = pool.query.bind(pool);
    (pool as any).query = async (...args: any[]) => {
      state.inFlight++;
      state.totalQueries++;
      state.peakInFlight = Math.max(state.peakInFlight, state.inFlight);
      try {
        return await (originalQuery as any)(...args);
      } finally {
        state.inFlight--;
      }
    };

    const originalConnect = pool.connect.bind(pool);
    (pool as any).connect = async () => {
      const client = await (originalConnect as any)();
      state.checkedOut++;
      state.totalConnects++;
      state.peakClientsCheckedOut = Math.max(state.peakClientsCheckedOut, state.checkedOut);
      const originalRelease = client.release.bind(client);
      client.release = (...args: any[]) => {
        state.checkedOut--;
        return originalRelease(...args);
      };
      return client;
    };

    return state;
  }

  it('init() must serialize DDL — peak concurrent pool.query() calls stays at 1', async () => {
    // This is the strongest, most reliable witness to the bug. Unlike
    // the symptoms (statement_timeout, connectionTimeoutMillis) which
    // only surface under Supabase-grade latency amplification and
    // can't be reproduced reliably against a local Postgres, the
    // fan-out itself is directly observable on the pg.Pool the moment
    // init() runs.
    //
    // BEFORE THE FIX: every domain's chained `pool.query(...)` calls
    //   each take their own backend, all concurrently via
    //   `Promise.all`. peakInFlight on this codebase is ~340 (well
    //   over the pool's `max: 20`).
    // AFTER THE FIX: serialized init touches one backend at a time so
    //   peakInFlight === 1.
    //
    // The Supabase production symptom (`canceling statement due to
    // statement timeout`) follows directly from this: any peakInFlight
    // > 1 means DDL is racing on the same relation, and on a real
    // Supabase pooler that race amplifies into the reported timeout.
    const schemaName = `it17679_fanout_${Date.now()}`;
    const pool = new Pool({ connectionString, max: 20 });
    const probe = instrumentPool(pool);

    const store = new PostgresStore({ id: `pg-17679-fanout-${Date.now()}`, pool, schemaName });

    try {
      await store.init();
      // Sanity: init actually ran DDL through SOME path (either pooled
      // queries via pool.query, or a pinned client via pool.connect()).
      expect(probe.totalQueries + probe.totalConnects).toBeGreaterThan(0);
      // The real invariant: at most one backend is in use at any moment
      // during init, whether it's because we serialized per-statement
      // queries (peakInFlight stays at 1, peakClientsCheckedOut === 0)
      // or because we pinned every domain's DDL to a single backend
      // (peakClientsCheckedOut === 1, peakInFlight === 0).
      const peakBackendsInUse = Math.max(probe.peakInFlight, probe.peakClientsCheckedOut);
      expect(peakBackendsInUse).toBe(1);
    } finally {
      await dropSchema(schemaName);
      await store.close();
      await pool.end();
    }
  });

  it('init() must not over-acquire pool slots even when the pool is small (max=2)', async () => {
    // Complementary check: the bug isn't just about peak concurrency
    // in a generous pool — it manifests as "every domain is asking for
    // a connection right now" under any pool size. Here we shrink the
    // pool to 2 and assert at most one backend is in use.
    //
    // BEFORE THE FIX: peakInFlight saturates at 2 (the pool max) and
    //   the other ~340 calls just queue. The init "succeeds" but the
    //   pool is a bottleneck and any per-connection latency (real
    //   Supabase pooler) amplifies that queue into seconds.
    // AFTER THE FIX (either per-statement serial or single-backend
    //   pinning): at most one backend in use.
    const schemaName = `it17679_small_pool_${Date.now()}`;
    const pool = new Pool({ connectionString, max: 2 });
    const probe = instrumentPool(pool);

    const store = new PostgresStore({ id: `pg-17679-small-pool-${Date.now()}`, pool, schemaName });

    try {
      await store.init();
      const peakBackendsInUse = Math.max(probe.peakInFlight, probe.peakClientsCheckedOut);
      expect(peakBackendsInUse).toBe(1);
    } finally {
      await dropSchema(schemaName);
      await store.close();
      await pool.end();
    }
  });
});

describe('PostgresStore.init() — concurrency & disableInit (issue #18282)', () => {
  /** Best-effort isolation: each test runs against its own schema. */
  async function dropSchema(schemaName: string) {
    try {
      const cleanup = new Pool({ connectionString });
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await cleanup.end();
    } catch {}
  }

  /** Counts how many times `pool.connect()` is called (the pinned-init path). */
  function countConnects(pool: Pool) {
    const state = { connects: 0 };
    const originalConnect = pool.connect.bind(pool);
    // Forward all args (pg's internal pool.query() calls connect with a
    // callback) so wrapping connect doesn't break ordinary queries.
    (pool as any).connect = (...args: any[]) => {
      state.connects++;
      return (originalConnect as any)(...args);
    };
    return state;
  }

  /** Queries table existence through a fresh pool to avoid the instrumented one. */
  async function tableExists(schemaName: string): Promise<boolean> {
    const probePool = new Pool({ connectionString });
    try {
      const res = await probePool.query(`SELECT to_regclass($1) AS tbl`, [`"${schemaName}"."${TABLE_THREADS}"`]);
      return res.rows[0].tbl !== null;
    } finally {
      await probePool.end();
    }
  }

  it('does not throw "RoutingDbClient already has a pinned client" on concurrent init()', async () => {
    // Mirrors the reported architecture: one shared PostgresStore whose
    // init() is triggered by multiple request-scoped Mastra instances at the
    // same time. Both calls race past the boolean guard and reach pin(),
    // and the second pin() throws today. After the single-flight fix, both
    // callers await one shared init promise.
    const schemaName = `it18282_concurrent_${Date.now()}`;
    const pool = new Pool({ connectionString });
    const store = new PostgresStore({ id: `pg-18282-concurrent-${Date.now()}`, pool, schemaName });

    try {
      // Fire several overlapping init() calls. Should resolve, not reject.
      await expect(Promise.all([store.init(), store.init(), store.init()])).resolves.toBeDefined();

      // Schema/tables must actually exist afterwards (init really ran once).
      expect(await tableExists(schemaName)).toBe(true);
    } finally {
      await dropSchema(schemaName);
      await store.close();
      await pool.end();
    }
  });

  it('init() is a no-op when disableInit is true (skips the pinned-client path)', async () => {
    // With externally managed schema, init() must not connect/pin/DDL.
    // The call-site in @mastra/core (mastra/index.ts) asserts init() is
    // "a no-op when disabled" — this enforces that contract for PG.
    const schemaName = `it18282_disabled_${Date.now()}`;
    const pool = new Pool({ connectionString });
    const probe = countConnects(pool);
    const store = new PostgresStore({
      id: `pg-18282-disabled-${Date.now()}`,
      pool,
      schemaName,
      disableInit: true,
    });

    try {
      await store.init();

      // No pinned-client connection should have been acquired.
      expect(probe.connects).toBe(0);

      // And no tables should have been created by init().
      expect(await tableExists(schemaName)).toBe(false);
    } finally {
      await dropSchema(schemaName);
      await store.close();
      await pool.end();
    }
  });

  it('retries init() after a transient connect() failure (#initPromise is reset)', async () => {
    // A failing pool.connect() during boot must not permanently poison the
    // store: the cached #initPromise is reset on failure so a later init()
    // can re-run. Reject the first connect(), then fall through to the real one.
    const schemaName = `it18282_retry_${Date.now()}`;
    const pool = new Pool({ connectionString });
    const originalConnect = pool.connect.bind(pool);
    let failNext = true;
    (pool as any).connect = (...args: any[]) => {
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('transient connect failure'));
      }
      return (originalConnect as any)(...args);
    };
    const store = new PostgresStore({ id: `pg-18282-retry-${Date.now()}`, pool, schemaName });

    try {
      // First init() hits the failing connect() and must reject.
      await expect(store.init()).rejects.toThrow();

      // A subsequent init() must succeed (the rejected promise was cleared).
      await expect(store.init()).resolves.toBeUndefined();
      expect(await tableExists(schemaName)).toBe(true);
    } finally {
      await dropSchema(schemaName);
      await store.close();
      await pool.end();
    }
  });
});
