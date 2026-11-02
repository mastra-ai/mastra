import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as knowledgeCompat from '@internal/core/knowledge-compat';
import { KNOWLEDGE_PAGES_TABLE_NAMES } from '@internal/core/knowledge-compat';
import {
  createKnowledgeLegacyUpgradeTests,
  createKnowledgeSchemaResetTests,
  createKnowledgePageStoreTests,
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
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

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
      expect(names).toEqual(new Set([...KNOWLEDGE_PAGES_TABLE_NAMES, 'mastra_knowledge_pin_audiences']));
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
