import {
  createKnowledgeImporterHostTests,
  createKnowledgeHostedImporterHostTests,
  createKnowledgeHostWriteTests,
  createKnowledgeImporterExportDDLTests,
  createKnowledgeImportersStorageTests,
  createKnowledgeLegacyUpgradeTests,
  createKnowledgePageStoreTests,
  createKnowledgeSearchSnippetTests,
  createKnowledgeTransactionTests,
  knowledgeStoreThroughTransactions,
} from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from '../../client';
import type { DbClient } from '../../db';
import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';

import { getPgKnowledgeIsolationKey, KnowledgePG, pgKnowledgeTransactionClient } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const pool = new Pool({ connectionString });
afterAll(async () => {
  await pool.end();
});

describe('KnowledgePG storage isolation', () => {
  it('lets PostgresStore callers override the isolation key', () => {
    const derived = new PostgresStore({ id: 'derived', pool, schemaName: 'shared' });
    const overridden = new PostgresStore({
      id: 'overridden',
      pool,
      schemaName: 'shared',
      storageIsolationKey: 'tenant-a',
    });

    expect(overridden.stores.knowledge!.getStorageIsolationKey()).toBe('tenant-a');
    expect(derived.stores.knowledge!.getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('identifies domains using the same pool and schema as one physical backend', () => {
    expect(new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgePG({ pool, schemaName: 'first' }).getStorageIsolationKey()).not.toBe(
      new KnowledgePG({ pool, schemaName: 'second' }).getStorageIsolationKey(),
    );
  });

  it('canonicalizes equivalent connection forms', () => {
    expect(
      getPgKnowledgeIsolationKey({
        connectionString: 'postgresql://first:secret@EXAMPLE.com/knowledge?sslmode=require',
        schemaName: 'shared',
      }),
    ).toBe(
      getPgKnowledgeIsolationKey({
        host: 'example.com',
        port: 5432,
        database: 'knowledge',
        schemaName: 'shared',
      }),
    );
  });

  it('identifies pools that reach the same database through PG environment defaults', () => {
    const saved = { PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT, PGDATABASE: process.env.PGDATABASE };
    Object.assign(process.env, { PGHOST: 'db.internal', PGPORT: '6543', PGDATABASE: 'knowledge' });
    const first = new Pool();
    const second = new Pool();
    try {
      const key = getPgKnowledgeIsolationKey({ pool: first, schemaName: 'shared' });
      expect(key).toBe('pg:db.internal:6543/knowledge:schema:shared');
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'shared' })).toBe(key);
      expect(
        getPgKnowledgeIsolationKey({ host: 'DB.internal', port: 6543, database: 'knowledge', schemaName: 'shared' }),
      ).toBe(key);
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'other' })).not.toBe(key);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      void first.end();
      void second.end();
    }
  });

  it('treats stores whose database cannot be determined as possibly shared', () => {
    const first = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    const second = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'shared' })).toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'shared' }),
    );
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'first' })).not.toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'second' }),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });
});

beforeAll(async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS knowledge_contract_test');
});

createKnowledgePageStoreTests(() => new KnowledgePG({ pool, schemaName: 'knowledge_contract_test' }));
createKnowledgeHostWriteTests(() => new KnowledgePG({ pool, schemaName: 'knowledge_contract_test' }));

beforeAll(async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS knowledge_snippet_test');
});
const snippetStorage = new PostgresStore({ id: 'knowledge-snippets', pool, schemaName: 'knowledge_snippet_test' });
createKnowledgeSearchSnippetTests(() => snippetStorage);

describe('through transaction views', () => {
  beforeAll(async () => {
    await pool.query('CREATE SCHEMA IF NOT EXISTS knowledge_contract_tx_test');
  });
  createKnowledgePageStoreTests(() =>
    knowledgeStoreThroughTransactions(new KnowledgePG({ pool, schemaName: 'knowledge_contract_tx_test' })),
  );
});

const TX_SCHEMA = 'knowledge_transaction_test';
const txTable = (name: string) => `"${TX_SCHEMA}"."${name}"`;
createKnowledgeTransactionTests(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${TX_SCHEMA}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${TX_SCHEMA}"`);
  const store = new KnowledgePG({ pool, schemaName: TX_SCHEMA });
  await store.init();
  // Its own pool, so the reader never borrows the writer's connection.
  const readerPool = new Pool({ connectionString });
  const sql = (tx: Parameters<typeof pgKnowledgeTransactionClient>[0]) => pgKnowledgeTransactionClient(tx);
  return {
    store,
    reader: new KnowledgePG({ pool: readerPool, schemaName: TX_SCHEMA }),
    rows: {
      reset: async () => {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${txTable('nodes')} (source_id text PRIMARY KEY, page_id text NOT NULL)`,
        );
        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${txTable('state')} (binding_id text PRIMARY KEY, cursor text NOT NULL)`,
        );
        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${txTable('receipts')} (run_id text, seq int, digest text NOT NULL, applied int NOT NULL, PRIMARY KEY (run_id, seq))`,
        );
        await pool.query(
          `CREATE TABLE IF NOT EXISTS ${txTable('runs')} (run_id text PRIMARY KEY, last_seq int NOT NULL)`,
        );
        await pool.query(
          `TRUNCATE ${txTable('nodes')}, ${txTable('state')}, ${txTable('receipts')}, ${txTable('runs')}`,
        );
      },
      startRun: async runId => {
        await pool.query(`INSERT INTO ${txTable('runs')} VALUES ($1, 0)`, [runId]);
      },
      receipt: (tx, runId, seq) =>
        sql(tx).oneOrNone(`SELECT digest, applied FROM ${txTable('receipts')} WHERE run_id = $1 AND seq = $2`, [
          runId,
          seq,
        ]),
      lastSeq: async (tx, runId) =>
        (await sql(tx).one(`SELECT last_seq FROM ${txTable('runs')} WHERE run_id = $1 FOR UPDATE`, [runId])).last_seq,
      addNode: async (tx, sourceId, pageId) => {
        await sql(tx).none(`INSERT INTO ${txTable('nodes')} VALUES ($1, $2)`, [sourceId, pageId]);
      },
      setCursor: async (tx, cursor) => {
        await sql(tx).none(
          `INSERT INTO ${txTable('state')} VALUES ('b1', $1) ON CONFLICT (binding_id) DO UPDATE SET cursor = EXCLUDED.cursor`,
          [cursor],
        );
      },
      addReceipt: async (tx, runId, seq, digest, applied) => {
        await sql(tx).none(`INSERT INTO ${txTable('receipts')} VALUES ($1, $2, $3, $4)`, [runId, seq, digest, applied]);
      },
      setLastSeq: async (tx, runId, seq) => {
        await sql(tx).none(`UPDATE ${txTable('runs')} SET last_seq = $2 WHERE run_id = $1`, [runId, seq]);
      },
      observe: async runId => {
        const [nodes, state, receipts, run] = await Promise.all([
          readerPool.query(`SELECT source_id FROM ${txTable('nodes')} ORDER BY source_id`),
          readerPool.query(`SELECT cursor FROM ${txTable('state')} WHERE binding_id = 'b1'`),
          readerPool.query(`SELECT seq FROM ${txTable('receipts')} WHERE run_id = $1 ORDER BY seq`, [runId]),
          readerPool.query(`SELECT last_seq FROM ${txTable('runs')} WHERE run_id = $1`, [runId]),
        ]);
        return {
          nodes: nodes.rows.map(row => String(row.source_id)),
          cursor: state.rows[0]?.cursor ?? null,
          receipts: receipts.rows.map(row => Number(row.seq)),
          lastSeq: run.rows[0] ? Number(run.rows[0].last_seq) : null,
        };
      },
    },
    cleanup: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${TX_SCHEMA}" CASCADE`);
      await readerPool.end();
    },
  };
});

const LEGACY_SCHEMA = 'knowledge_legacy_test';
const legacyTable = (name: string) => `"${LEGACY_SCHEMA}"."${name}"`;
const legacyKnowledgeTables = async () =>
  (
    await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra\\_knowledge\\_%'`,
      [LEGACY_SCHEMA],
    )
  ).rows.map(row => String(row.table_name));

createKnowledgeLegacyUpgradeTests({
  createStore: () => new KnowledgePG({ pool, schemaName: LEGACY_SCHEMA }),
  clear: async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${LEGACY_SCHEMA}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${LEGACY_SCHEMA}"`);
    await pool.query(`CREATE TABLE ${legacyTable('existing_domain')} (id text PRIMARY KEY)`);
    await pool.query(`INSERT INTO ${legacyTable('existing_domain')} VALUES ('preserved')`);
  },
  // The shape @mastra/pg 1.33.0 created, reduced to the columns, keys and references that matter here.
  createPublishedLayout: async ({ rows }) => {
    await pool.query(`CREATE TABLE ${legacyTable('mastra_knowledge_nodes')} (id text PRIMARY KEY, name text)`);
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_records')} (id text PRIMARY KEY, node text REFERENCES ${legacyTable('mastra_knowledge_nodes')} (id))`,
    );
    await pool.query(`CREATE TABLE ${legacyTable('mastra_knowledge_semantic_outbox')} (id text PRIMARY KEY)`);
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_mentions')} ("sourceType" text, "sourceId" text, "recordId" text, PRIMARY KEY ("recordId", "sourceId"))`,
    );
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_activity')} (id text PRIMARY KEY, action text, "recordType" text, "recordId" text)`,
    );
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_access_state')} (id text PRIMARY KEY, epoch integer NOT NULL, "schemaVersion" integer NOT NULL)`,
    );
    if (!rows) return;
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_access_state')} VALUES ('knowledge', 1, 2)`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_nodes')} VALUES ('01LEGACY', 'Legacy')`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_records')} VALUES ('01REC', '01LEGACY')`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_mentions')} VALUES ('record', '01REC', '01REC')`);
    await pool.query(
      `INSERT INTO ${legacyTable('mastra_knowledge_activity')} VALUES ('01ACT', 'create', 'node', '01LEGACY')`,
    );
  },
  recreateLegacyTables: async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_nodes')} (id text PRIMARY KEY, name text)`,
    );
    await pool.query(`CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_records')} (id text PRIMARY KEY)`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_semantic_outbox')} (id text PRIMARY KEY)`,
    );
    await pool.query(
      `INSERT INTO ${legacyTable('mastra_knowledge_nodes')} VALUES ('01OLD', 'Old') ON CONFLICT DO NOTHING`,
    );
  },
  knowledgeTables: legacyKnowledgeTables,
  otherTableRows: async () =>
    Number((await pool.query(`SELECT COUNT(*) AS n FROM ${legacyTable('existing_domain')}`)).rows[0].n),
});

const IMPORTERS_SCHEMA = 'knowledge_importers_test';
const IMPORTERS_OTHER_SCHEMA = 'knowledge_importers_other_test';
const IMPORTERS_UNPROVISIONED_SCHEMA = 'knowledge_importers_unprovisioned_test';
createKnowledgeImportersStorageTests(async () => {
  for (const schema of [IMPORTERS_SCHEMA, IMPORTERS_OTHER_SCHEMA, IMPORTERS_UNPROVISIONED_SCHEMA]) {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schema}"`);
  }
  const provision = async (schemaName: string) => {
    const store = new KnowledgePG({ pool, schemaName });
    await store.init();
    await store.importers!.init();
    return store;
  };
  const store = await provision(IMPORTERS_SCHEMA);
  const otherNamespace = await provision(IMPORTERS_OTHER_SCHEMA);
  // Its own pool, so the reader never borrows the writer's connection.
  const readerPool = new Pool({ connectionString });
  return {
    store,
    reader: new KnowledgePG({ pool: readerPool, schemaName: IMPORTERS_SCHEMA }),
    otherNamespace,
    locks: {
      sessionOf: async tx => Number((await pgKnowledgeTransactionClient(tx).one('SELECT pg_backend_pid() AS pid')).pid),
      blockedBy: async session =>
        Number(
          (
            await readerPool.query(`SELECT count(*) AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`, [
              session,
            ])
          ).rows[0].n,
        ),
    },
    unprovisioned: {
      store: new KnowledgePG({ pool, schemaName: IMPORTERS_UNPROVISIONED_SCHEMA }),
      importerTablesExist: async () =>
        Number(
          (
            await pool.query(
              `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra\\_knowledge\\_importer\\_%'`,
              [IMPORTERS_UNPROVISIONED_SCHEMA],
            )
          ).rows[0].n,
        ) === 8,
    },
    concurrentTransactions: true,
    cleanup: async () => {
      for (const schema of [IMPORTERS_SCHEMA, IMPORTERS_OTHER_SCHEMA, IMPORTERS_UNPROVISIONED_SCHEMA]) {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
      await readerPool.end();
    },
  };
});

const GATE_SCHEMA = 'knowledge_tx_gate_test';
describe('KnowledgePG transaction: a failure caught outside a savepoint', () => {
  it('rejects the transaction instead of reporting a commit PostgreSQL turned into a rollback', async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${GATE_SCHEMA}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${GATE_SCHEMA}"`);
    try {
      const store = new KnowledgePG({ pool, schemaName: GATE_SCHEMA });
      await store.init();
      const who = { author: 'importer:test' };
      const { scope } = await store.materializeScope({
        address: 'org:acme',
        declaration: 'org:$orgId',
        name: 'Acme',
        provenance: who,
      });
      const outcome = store.transaction(async tx => {
        await tx.createPage({ parentId: scope.id, name: 'Written first', provenance: who });
        // A statement on the transaction itself, not in a savepoint: PostgreSQL aborts the transaction.
        await pgKnowledgeTransactionClient(tx)
          .query('SELECT 1 / 0')
          .catch(() => undefined);
        // The next store call drains that failure before its savepoint; the caller swallows it too.
        await tx.createPage({ parentId: scope.id, name: 'Written after', provenance: who }).catch(() => undefined);
        return 'looks fine';
      });
      await expect(outcome).rejects.toThrow();
      expect(await store.getPageByPath({ scopeId: scope.id, path: ['Written first'], read: 'all' })).toBeNull();
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${GATE_SCHEMA}" CASCADE`);
    }
  });
});

let importerHostSchemas = 0;
const importerHostFixture = async () => {
  const schemaName = `knowledge_importer_host_${process.pid}_${++importerHostSchemas}`;
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  return {
    storage: new PostgresStore({ id: 'importer-host', pool, schemaName }),
    cleanup: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    },
  };
};
createKnowledgeImporterHostTests(importerHostFixture);
createKnowledgeHostedImporterHostTests(importerHostFixture);

createKnowledgeImporterExportDDLTests(async () => {
  const schemaName = `knowledge_importer_export_${process.pid}`;
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  for (const statement of [...KnowledgePG.getExportDDL(schemaName), ...KnowledgePG.getImportersExportDDL(schemaName)]) {
    await pool.query(statement);
  }
  return {
    storage: new PostgresStore({ id: 'importer-export', pool, schemaName, disableInit: true }),
    cleanup: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    },
  };
});
