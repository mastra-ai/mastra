import { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresStore } from './index';

const TOXIPROXY_API = 'http://localhost:8475';
const PROXY_NAME = 'pg';

/**
 * Configure Toxiproxy to forward TCP traffic from `toxiproxy:5432` to
 * `db:5432` and inject a small per-statement latency. The latency turns
 * a near-instant local Postgres into a realistic remote-pooler workload,
 * which is what makes the parallel-DDL fan-out actually trip
 * statement_timeout (locally Postgres answers too fast for the bug to
 * surface even with a 500ms timeout).
 */
async function configureToxiproxy(latencyMs: number) {
  // Recreate the proxy idempotently.
  await fetch(`${TOXIPROXY_API}/proxies/${PROXY_NAME}`, { method: 'DELETE' }).catch(() => {});
  const create = await fetch(`${TOXIPROXY_API}/proxies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: PROXY_NAME,
      listen: '0.0.0.0:5432',
      upstream: 'db:5432',
      enabled: true,
    }),
  });
  if (!create.ok) throw new Error(`toxiproxy create failed: ${create.status} ${await create.text()}`);

  const tox = await fetch(`${TOXIPROXY_API}/proxies/${PROXY_NAME}/toxics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'latency',
      attributes: { latency: latencyMs, jitter: 0 },
      stream: 'downstream',
    }),
  });
  if (!tox.ok) throw new Error(`toxiproxy toxic failed: ${tox.status} ${await tox.text()}`);
}

/**
 * Real-pooler smoke test for https://github.com/mastra-ai/mastra/issues/17679
 *
 * Stands up PgBouncer (transaction-pooling mode) in front of Postgres so
 * we can reproduce the exact production failure mode the reporter hit on
 * Supabase: every statement is a separate pooler transaction, the pool
 * budget is smaller than the burst from MastraCompositeStore init(), and
 * Postgres enforces a tight `statement_timeout` against the queue wait
 * baked in by the pooler.
 *
 * Before the fix, init() throws:
 *   "canceling statement due to statement timeout" inside
 *   _ObservabilityPG.init -> createTable -> alterTable
 * After the fix, init() pins all DDL to a single backend so the pooler
 * sees exactly one transaction and no statement queues behind another.
 *
 * Container topology (see docker-compose.pooler.yaml):
 *   - postgres: max_connections=25, statement_timeout=500, lock_timeout=500
 *   - pgbouncer: POOL_MODE=transaction, DEFAULT_POOL_SIZE=3, port 6433
 */
describe('PostgresStore.init() under pgBouncer transaction pooling (issue #17679)', () => {
  const connectionString = 'postgresql://postgres:postgres@localhost:6433/postgres';
  let schemaName: string;

  beforeAll(async () => {
    // 25ms one-way latency simulates regional Supabase pooler hops. The
    // exact value isn't load-bearing — what matters is that the test
    // exercises the multi-RTT path so connection-management correctness
    // (not raw round-trip count) determines the outcome.
    await configureToxiproxy(25);
  });

  beforeEach(() => {
    schemaName = `it17679_pooler_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  });

  afterEach(async () => {
    // Cleanup goes directly to Postgres (bypassing pgBouncer) so DROP
    // SCHEMA runs in a single session.
    const cleanup = new Pool({
      connectionString: 'postgresql://postgres:postgres@localhost:5437/postgres',
    });
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch {
      // best-effort
    } finally {
      await cleanup.end();
    }
  });

  it('completes init through pgBouncer without statement_timeout errors and acquires exactly one pooler backend', async () => {
    const pool = new Pool({
      connectionString,
      // Match what a typical user would set when targeting a Supabase
      // pooler: a generous Node-side pool that lets the bug surface as
      // server-side queue contention rather than client-side connection
      // starvation.
      max: 20,
    });

    // Track concurrent pool.connect() checkouts — this is what the pooler
    // bills as separate transactions, and what gets queued when
    // DEFAULT_POOL_SIZE is exhausted.
    let inFlight = 0;
    let peakClientsCheckedOut = 0;
    const originalConnect = pool.connect.bind(pool);
    (pool as any).connect = async () => {
      const client = await (originalConnect as any)();
      inFlight++;
      peakClientsCheckedOut = Math.max(peakClientsCheckedOut, inFlight);
      const originalRelease = client.release.bind(client);
      client.release = (...args: any[]) => {
        inFlight--;
        return originalRelease(...args);
      };
      return client;
    };

    const store = new PostgresStore({
      id: `pg-17679-pooler-${Date.now()}`,
      pool,
      schemaName,
    });

    try {
      // The critical assertion: init() completes without throwing the
      // user-reported "canceling statement due to statement timeout"
      // error.
      await expect(store.init()).resolves.toBeUndefined();

      // The fix guarantees init holds exactly one backend connection
      // for the entire DDL chain. Without the fix this number explodes
      // (Node-side pool would queue ~200 checkout requests, and the
      // pooler would queue the same on its 3-slot budget — the dominant
      // cause of the reported failure).
      expect(peakClientsCheckedOut).toBe(1);
    } finally {
      // Always release pool and store handles so a failed assertion
      // doesn't leak connections into the next test.
      await store.close().catch(() => {});
      await pool.end();
    }
  });
});
