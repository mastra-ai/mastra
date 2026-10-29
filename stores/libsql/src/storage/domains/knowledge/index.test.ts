import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as knowledgeCompat from '@internal/core/knowledge-compat';
import { KNOWLEDGE_PAGES_TABLE_NAMES } from '@internal/core/knowledge-compat';
import { createKnowledgeSchemaResetTests, createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import {
  KNOWLEDGE_TABLE_NAMES,
  KnowledgeSchemaResetRequiredError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_RECORDS,
} from '@mastra/core/storage';
import * as coreStorage from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { withClientWriteLock } from '../../db/write-lock';
import { LibSQLStore } from '../../index';
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

const COMPAT_CONSTANTS = [
  'KNOWLEDGE_ACCESS_STATE_SCHEMA',
  'KNOWLEDGE_IMPORT_RUNS_SCHEMA',
  'KNOWLEDGE_IMPORT_STATE_SCHEMA',
  'KNOWLEDGE_NODE_ADDRESSES_SCHEMA',
  'KNOWLEDGE_NODE_SCOPES_SCHEMA',
  'KNOWLEDGE_PROPOSALS_SCHEMA',
  'KNOWLEDGE_RECORD_SCOPES_SCHEMA',
  'KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA',
  'KNOWLEDGE_SCOPE_GRANTS_SCHEMA',
  'KNOWLEDGE_STORAGE_CONTRACT_VERSION',
  'KNOWLEDGE_STORAGE_SCHEMA_VERSION',
  'KNOWLEDGE_TABLE_NAMES',
  'KNOWLEDGE_V2_ACTIVITY_SCHEMA',
  'KNOWLEDGE_V2_MENTIONS_SCHEMA',
  'KNOWLEDGE_V2_NODES_SCHEMA',
  'KNOWLEDGE_V2_RECORDS_SCHEMA',
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

describe('Knowledge v2 Core compatibility', () => {
  it('keeps bundled constants byte-for-byte compatible with current Core', () => {
    for (const name of COMPAT_CONSTANTS) {
      expect(knowledgeCompat[name]).toEqual(coreStorage[name]);
    }
  });

  it('rejects an old Core before loading its storage module', async () => {
    const loadStorageModule = vi.fn();
    const loadCore = knowledgeCompat.createKnowledgeV2CoreLoader(new Set(), loadStorageModule);

    await expect(loadCore()).rejects.toThrow(
      'Knowledge v2 requires a @mastra/core release with the "knowledge-v2" feature. Upgrade @mastra/core to use Knowledge; other storage domains keep working on this version.',
    );
    expect(loadStorageModule).not.toHaveBeenCalled();
  });

  it('coalesces successful loads and retries a failed load', async () => {
    const storageModule = {
      assertKnowledgeDescriptionWithinBound: vi.fn(),
      assertKnowledgeRecordTextWithinBound: vi.fn(),
      assertKnowledgeSchemaCompatible: vi.fn(),
      inspectKnowledgeSchema: vi.fn(() => ({ status: 'uninitialized', schemaVersion: null })),
    };
    const loadStorageModule = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(storageModule);
    const loadCore = knowledgeCompat.createKnowledgeV2CoreLoader(new Set(['knowledge-v2']), loadStorageModule);

    await expect(loadCore()).rejects.toThrow('temporary failure');
    const [first, second] = await Promise.all([loadCore(), loadCore()]);

    expect(first).toBe(second);
    expect(loadStorageModule).toHaveBeenCalledTimes(2);
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
  await seedPublishedKnowledgeV1(client);
  // A host-added index makes the layout unrecognized, so init must refuse and only reset may replace it.
  await client.execute('CREATE INDEX custom_knowledge_index ON mastra_knowledge_nodes (name)');
  await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
  await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
  await client.execute({
    sql: `INSERT INTO "mastra_knowledge_nodes" (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      '01LEGACY000000000000000000',
      'node',
      'Legacy',
      'legacy',
      'task',
      'legacy body',
      JSON.stringify(['org:acme', 'resource:mastra']),
      'org:acme\u001fresource:mastra',
      1,
      null,
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  });
  const store = new KnowledgeLibSQL({ client });
  return {
    store,
    snapshot: async () => ({
      schema: (await client.execute('SELECT * FROM sqlite_master ORDER BY type, name')).rows,
      nodes: (await client.execute('SELECT * FROM mastra_knowledge_nodes')).rows,
    }),
    assertResetResult: async () => {
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra\\_knowledge\\_%' ESCAPE '\\'",
      );
      const names = new Set(tables.rows.map(row => String(row.name)));
      expect(names).toEqual(new Set(KNOWLEDGE_PAGES_TABLE_NAMES));
    },
    cleanup: async () => client.close(),
  };
});
