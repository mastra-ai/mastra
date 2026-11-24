import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as knowledgeCompat from '@internal/core/knowledge-compat';
import { KNOWLEDGE_PAGES_TABLE_NAMES } from '@internal/core/knowledge-compat';
import {
  createKnowledgeImporterExportDDLTests,
  createKnowledgeImporterHostTests,
  createKnowledgeHostedImporterHostTests,
  createKnowledgeImportersStorageTests,
  createKnowledgeLegacyUpgradeTests,
  createKnowledgeSchemaResetTests,
  createKnowledgeHostWriteTests,
  createKnowledgePageStoreTests,
  createKnowledgeTransactionTests,
  knowledgeStoreThroughTransactions,
} from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import {
  KNOWLEDGE_TABLE_NAMES,
  KnowledgeSchemaResetRequiredError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_RECORDS,
} from '@mastra/core/storage';
import * as coreStorage from '@mastra/core/storage';
import { afterAll, describe, expect, it } from 'vitest';

import { withClientWriteLock } from '../../db/write-lock';
import { LibSQLStore } from '../../index';
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL, libsqlKnowledgeTransaction } from '.';

const COMPAT_CONSTANTS = [
  'KNOWLEDGE_STORAGE_CONTRACT_VERSION',
  'KNOWLEDGE_STORAGE_SCHEMA_VERSION',
  'KNOWLEDGE_TABLE_NAMES',
  'TABLE_KNOWLEDGE_ACCESS_STATE',
  'TABLE_KNOWLEDGE_IMPORT_RUNS',
  'TABLE_KNOWLEDGE_IMPORT_STATE',
  'TABLE_KNOWLEDGE_NODE_ADDRESSES',
  'TABLE_KNOWLEDGE_NODE_SCOPES',
  'TABLE_KNOWLEDGE_PROPOSALS',
  'TABLE_KNOWLEDGE_RECORD_SCOPES',
  'TABLE_KNOWLEDGE_SCOPE_ADDRESSES',
  'TABLE_KNOWLEDGE_SCOPE_GRANTS',
] as const;

describe('Knowledge Core compatibility', () => {
  it('keeps bundled constants byte-for-byte compatible with current Core', () => {
    for (const name of COMPAT_CONSTANTS) {
      expect(knowledgeCompat[name]).toEqual(coreStorage[name]);
    }
  });
});

createKnowledgePageStoreTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));
createKnowledgeHostWriteTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

describe('through transaction views', () => {
  createKnowledgePageStoreTests(() =>
    knowledgeStoreThroughTransactions(new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' })),
  );
});

createKnowledgeTransactionTests(async () => {
  // A file database, so the reader is a real second connection.
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-tx-'));
  const url = `file:${join(dir, 'knowledge.db')}`;
  const writer = createClient({ url });
  const readerClient = createClient({ url });
  const store = new KnowledgeLibSQL({ client: writer });
  await store.init();
  const sql = (tx: Parameters<typeof libsqlKnowledgeTransaction>[0]) => libsqlKnowledgeTransaction(tx);
  return {
    store,
    reader: new KnowledgeLibSQL({ client: readerClient }),
    rows: {
      reset: async () => {
        await writer.executeMultiple(`
          CREATE TABLE IF NOT EXISTS tx_nodes (source_id TEXT PRIMARY KEY, page_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS tx_state (binding_id TEXT PRIMARY KEY, cursor TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS tx_receipts (run_id TEXT, seq INTEGER, digest TEXT NOT NULL, applied INTEGER NOT NULL, PRIMARY KEY (run_id, seq));
          CREATE TABLE IF NOT EXISTS tx_runs (run_id TEXT PRIMARY KEY, last_seq INTEGER NOT NULL);
          DELETE FROM tx_nodes; DELETE FROM tx_state; DELETE FROM tx_receipts; DELETE FROM tx_runs;`);
      },
      startRun: async runId => {
        await writer.execute({ sql: 'INSERT INTO tx_runs VALUES (?, 0)', args: [runId] });
      },
      receipt: async (tx, runId, seq) => {
        const { rows } = await sql(tx).execute({
          sql: 'SELECT digest, applied FROM tx_receipts WHERE run_id = ? AND seq = ?',
          args: [runId, seq],
        });
        return rows[0] ? { digest: String(rows[0].digest), applied: Number(rows[0].applied) } : null;
      },
      // SQLite's write transaction already holds the database lock.
      lastSeq: async (tx, runId) =>
        Number(
          (await sql(tx).execute({ sql: 'SELECT last_seq FROM tx_runs WHERE run_id = ?', args: [runId] })).rows[0]!
            .last_seq,
        ),
      addNode: async (tx, sourceId, pageId) => {
        await sql(tx).execute({ sql: 'INSERT INTO tx_nodes VALUES (?, ?)', args: [sourceId, pageId] });
      },
      setCursor: async (tx, cursor) => {
        await sql(tx).execute({
          sql: "INSERT INTO tx_state VALUES ('b1', ?) ON CONFLICT (binding_id) DO UPDATE SET cursor = excluded.cursor",
          args: [cursor],
        });
      },
      addReceipt: async (tx, runId, seq, digest, applied) => {
        await sql(tx).execute({
          sql: 'INSERT INTO tx_receipts VALUES (?, ?, ?, ?)',
          args: [runId, seq, digest, applied],
        });
      },
      setLastSeq: async (tx, runId, seq) => {
        await sql(tx).execute({ sql: 'UPDATE tx_runs SET last_seq = ? WHERE run_id = ?', args: [seq, runId] });
      },
      observe: async runId => {
        const nodes = await readerClient.execute('SELECT source_id FROM tx_nodes ORDER BY source_id');
        const state = await readerClient.execute("SELECT cursor FROM tx_state WHERE binding_id = 'b1'");
        const receipts = await readerClient.execute({
          sql: 'SELECT seq FROM tx_receipts WHERE run_id = ? ORDER BY seq',
          args: [runId],
        });
        const run = await readerClient.execute({ sql: 'SELECT last_seq FROM tx_runs WHERE run_id = ?', args: [runId] });
        return {
          nodes: nodes.rows.map(row => String(row.source_id)),
          cursor: state.rows[0] ? String(state.rows[0].cursor) : null,
          receipts: receipts.rows.map(row => Number(row.seq)),
          lastSeq: run.rows[0] ? Number(run.rows[0].last_seq) : null,
        };
      },
    },
    cleanup: async () => {
      writer.close();
      readerClient.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
});

async function seedPublishedKnowledgeV1(client: ReturnType<typeof createClient>): Promise<void> {
  const sql = await readFile(new URL('./fixtures/published-1.21.1.sql', import.meta.url), 'utf8');
  await client.batch(
    sql
      .split(';')
      .map(statement => statement.trim())
      .filter(Boolean),
    'write',
  );
}

describe('KnowledgeLibSQL storage isolation', () => {
  it('identifies domains configured for the same URL as one physical backend', () => {
    expect(new KnowledgeLibSQL({ url: 'file:shared.db' }).getStorageIsolationKey()).toBe(
      new KnowledgeLibSQL({ url: 'file:./shared.db' }).getStorageIsolationKey(),
    );
    expect(getLibSQLKnowledgeIsolationKey({ url: 'file:///tmp/shared.db' })).toBe(
      getLibSQLKnowledgeIsolationKey({ url: 'file://localhost/tmp/shared.db' }),
    );
    expect(getLibSQLKnowledgeIsolationKey({ url: 'libsql://EXAMPLE.com/db?mode=ro' })).toBe(
      getLibSQLKnowledgeIsolationKey({ url: 'libsql://example.com:443/db' }),
    );
    expect(new KnowledgeLibSQL({ url: 'file:first.db' }).getStorageIsolationKey()).not.toBe(
      new KnowledgeLibSQL({ url: 'file:second.db' }).getStorageIsolationKey(),
    );
    expect(new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }).getStorageIsolationKey()).toBe(
      new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgeLibSQL({ url: ':memory:' }).getStorageIsolationKey()).not.toBe(
      new KnowledgeLibSQL({ url: ':memory:' }).getStorageIsolationKey(),
    );

    const firstClient = createClient({ url: 'file:first-client.db' });
    const secondClient = createClient({ url: 'file:second-client.db' });
    try {
      expect(getLibSQLKnowledgeIsolationKey({ client: firstClient })).toBe(
        getLibSQLKnowledgeIsolationKey({ client: secondClient }),
      );
      expect(getLibSQLKnowledgeIsolationKey({ client: firstClient, storageIsolationKey: 'first' })).not.toBe(
        getLibSQLKnowledgeIsolationKey({ client: secondClient, storageIsolationKey: 'second' }),
      );
    } finally {
      firstClient.close();
      secondClient.close();
    }
  });

  it('lets LibSQLStore callers override the isolation key', () => {
    const derived = new LibSQLStore({ id: 'derived', url: 'file:shared.db' });
    const overridden = new LibSQLStore({ id: 'overridden', url: 'file:shared.db', storageIsolationKey: 'tenant-a' });

    expect(overridden.stores.knowledge!.getStorageIsolationKey()).toBe('tenant-a');
    expect(derived.stores.knowledge!.getStorageIsolationKey()).toBe(
      new KnowledgeLibSQL({ url: 'file:shared.db' }).getStorageIsolationKey(),
    );
  });
});

createKnowledgeSchemaResetTests(async () => {
  const client = createClient({ url: ':memory:' });
  const store = new KnowledgeLibSQL({ client });
  await store.init();
  // A schema version this release doesn't know: init must refuse and only reset may replace it.
  await client.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET schemaVersion = 5 WHERE id = 'knowledge'`);
  await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
  await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
  return {
    store,
    snapshot: async () => ({
      schema: (await client.execute('SELECT * FROM sqlite_master ORDER BY type, name')).rows,
      state: (await client.execute(`SELECT * FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}"`)).rows,
    }),
    assertResetResult: async () => {
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra\\_knowledge\\_%' ESCAPE '\\'",
      );
      const names = new Set(tables.rows.map(row => String(row.name)));
      expect(names).toEqual(
        new Set([...KNOWLEDGE_PAGES_TABLE_NAMES, 'mastra_knowledge_pin_audiences', 'mastra_knowledge_page_links']),
      );
    },
    cleanup: async () => client.close(),
  };
});

const legacyDir = mkdtempSync(join(tmpdir(), 'knowledge-legacy-'));
const legacyClient = createClient({ url: `file:${join(legacyDir, 'legacy.db')}` });
afterAll(() => {
  legacyClient.close();
  rmSync(legacyDir, { recursive: true, force: true });
});
const knowledgeTableNames = async () =>
  (
    await legacyClient.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra\\_knowledge\\_%' ESCAPE '\\'",
    )
  ).rows.map(row => String(row.name));

createKnowledgeLegacyUpgradeTests({
  createStore: () => new KnowledgeLibSQL({ client: legacyClient }),
  clear: async () => {
    for (const name of await knowledgeTableNames()) await legacyClient.execute(`DROP TABLE "${name}"`);
    await legacyClient.execute('DROP TABLE IF EXISTS existing_domain');
    await legacyClient.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
    await legacyClient.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
  },
  createPublishedLayout: async ({ rows }) => {
    await seedPublishedKnowledgeV1(legacyClient);
    await legacyClient.execute(
      `CREATE TABLE "${TABLE_KNOWLEDGE_ACCESS_STATE}" (id TEXT PRIMARY KEY, epoch INTEGER NOT NULL, schemaVersion INTEGER NOT NULL)`,
    );
    if (!rows) return;
    await legacyClient.execute(`INSERT INTO "${TABLE_KNOWLEDGE_ACCESS_STATE}" VALUES ('knowledge', 1, 2)`);
    await legacyClient.execute({
      sql: `INSERT INTO "mastra_knowledge_nodes" (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: ['01LEGACY', 'node', 'Legacy', 'legacy', 'task', 'body', '["org:acme"]', 'org:acme', 1, null, 'x', 'x'],
    });
  },
  recreateLegacyTables: async () => {
    await legacyClient.execute('CREATE TABLE IF NOT EXISTS mastra_knowledge_nodes (id TEXT PRIMARY KEY, name TEXT)');
    await legacyClient.execute('CREATE TABLE IF NOT EXISTS mastra_knowledge_records (id TEXT PRIMARY KEY)');
    await legacyClient.execute('CREATE TABLE IF NOT EXISTS mastra_knowledge_semantic_outbox (id TEXT PRIMARY KEY)');
    await legacyClient.execute("INSERT INTO mastra_knowledge_nodes (id, name) VALUES ('01OLD', 'Old')");
  },
  knowledgeTables: knowledgeTableNames,
  otherTableRows: async () =>
    Number((await legacyClient.execute('SELECT COUNT(*) AS n FROM existing_domain')).rows[0]!.n),
});

createKnowledgeImportersStorageTests(async () => {
  // File databases, so the reader is a real second connection.
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-importers-'));
  const url = `file:${join(dir, 'knowledge.db')}`;
  const writer = createClient({ url });
  const readerClient = createClient({ url });
  const store = new KnowledgeLibSQL({ client: writer });
  await store.init();
  await store.importers!.init();
  const unprovisionedClient = createClient({ url: `file:${join(dir, 'unprovisioned.db')}` });
  return {
    store,
    reader: new KnowledgeLibSQL({ client: readerClient }),
    unprovisioned: {
      store: new KnowledgeLibSQL({ client: unprovisionedClient }),
      importerTablesExist: async () =>
        Number(
          (
            await unprovisionedClient.execute(
              "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra\\_knowledge\\_importer\\_%' ESCAPE '\\'",
            )
          ).rows[0]!.n,
        ) === 8,
    },
    // One client's write transactions are serialized, which is what the lock tests observe.
    concurrentTransactions: true,
    cleanup: async () => {
      writer.close();
      readerClient.close();
      unprovisionedClient.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
});

const importerHostFixture = async () => {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-importer-host-'));
  const storage = new LibSQLStore({ id: 'importer-host', url: `file:${join(dir, 'knowledge.db')}` });
  return {
    storage,
    cleanup: async () => {
      await storage.close?.();
      rmSync(dir, { recursive: true, force: true });
    },
  };
};
createKnowledgeImporterHostTests(importerHostFixture);
createKnowledgeHostedImporterHostTests(importerHostFixture);

createKnowledgeImporterExportDDLTests(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-importer-export-'));
  const url = `file:${join(dir, 'knowledge.db')}`;
  // LibSQL exports no page DDL: the pages domain provisions itself, the importer tables come from the export.
  const client = createClient({ url });
  await new KnowledgeLibSQL({ client }).init();
  for (const statement of KnowledgeLibSQL.getImportersExportDDL()) await client.execute(statement);
  client.close();
  const storage = new LibSQLStore({ id: 'importer-export', url, disableInit: true });
  return {
    storage,
    cleanup: async () => {
      await storage.close?.();
      rmSync(dir, { recursive: true, force: true });
    },
  };
});
