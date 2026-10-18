import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';

const TOXIPROXY_API = 'http://localhost:8475';
const POOLER_URL = 'postgresql://postgres:postgres@localhost:6433/postgres';
const DIRECT_URL = 'postgresql://postgres:postgres@localhost:5437/postgres';

/**
 * Observational memory generation creation is serialized with a
 * transaction-scoped advisory lock (https://github.com/mastra-ai/mastra/issues/22188).
 * PgBouncer in transaction mode hands each transaction to any backend, so a
 * session-scoped lock would not hold here. See docker-compose.pooler.yaml for the
 * topology: 3 backends, lock_timeout=500, plus 25ms latency per hop.
 */
describe('observational memory initialization through pgBouncer transaction pooling', () => {
  const schemaName = `om_gen_pooler_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let pools: Pool[];
  let stores: PostgresStore[];

  beforeAll(async () => {
    await fetch(`${TOXIPROXY_API}/proxies/pg`, { method: 'DELETE' }).catch(() => {});
    const proxy = await fetch(`${TOXIPROXY_API}/proxies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'pg', listen: '0.0.0.0:5432', upstream: 'db:5432', enabled: true }),
    });
    if (!proxy.ok) throw new Error(`toxiproxy create failed: ${proxy.status} ${await proxy.text()}`);
    const latency = await fetch(`${TOXIPROXY_API}/proxies/pg/toxics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'latency', attributes: { latency: 25, jitter: 0 }, stream: 'downstream' }),
    });
    if (!latency.ok) throw new Error(`toxiproxy toxic failed: ${latency.status} ${await latency.text()}`);

    // Two stores with separate pools stand in for two processes.
    pools = [0, 1].map(() => new Pool({ connectionString: POOLER_URL }));
    stores = pools.map((pool, i) => new PostgresStore({ id: `om-gen-pooler-${i}`, pool, schemaName }));
    await stores[0]!.init();
    await stores[1]!.init();
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close().catch(() => {})));
    // The stores don't own caller-provided pools, so close() leaves them open.
    await Promise.all(pools.map(pool => pool.end().catch(() => {})));
    const direct = new Pool({ connectionString: DIRECT_URL });
    await direct.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await direct.end();
  });

  it('creates one record when both processes initialize the same resource at once', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const memories = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));

    const records = await Promise.all(
      memories.flatMap(memory =>
        Array.from({ length: 6 }, () =>
          memory.initializeObservationalMemory({
            threadId: null,
            resourceId,
            scope: 'resource',
            config: {},
          }),
        ),
      ),
    );

    const direct = new Pool({ connectionString: DIRECT_URL });
    try {
      const { rows } = await direct.query(
        `SELECT id FROM "${schemaName}"."mastra_observational_memory" WHERE "lookupKey" = $1`,
        [`resource:${resourceId}`],
      );
      expect(rows).toHaveLength(1);
      expect(new Set(records.map(r => r.id))).toEqual(new Set([rows[0].id]));
    } finally {
      await direct.end();
    }
  });
});
