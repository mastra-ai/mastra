import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as knowledgeCompat from '@internal/core/knowledge-compat';
import { createKnowledgeSchemaResetTests, createKnowledgeStorageTests } from '@internal/storage-test-utils';
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
      'Knowledge v2 requires @mastra/core >=1.65.0-0 with the "knowledge-v2" feature',
    );
    expect(loadStorageModule).not.toHaveBeenCalled();
  });

  it('coalesces successful loads and retries a failed load', async () => {
    const storageModule = {
      assertKnowledgeDescriptionWithinBound: vi.fn(),
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

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

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
  });
});

createKnowledgeSchemaResetTests(async () => {
  const client = createClient({ url: ':memory:' });
  await seedPublishedKnowledgeV1(client);
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
      expect((await client.execute(`SELECT id FROM "${TABLE_KNOWLEDGE_RECORDS}"`)).rows).toEqual([]);
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%'",
      );
      expect(new Set(tables.rows.map(row => String(row.name)))).toEqual(new Set(KNOWLEDGE_TABLE_NAMES));
      expect(
        (await client.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`)).rows[0]?.epoch,
      ).toBe(0);
    },
    cleanup: async () => client.close(),
  };
});

describe('KnowledgeLibSQL initialization', () => {
  it.each([
    'CREATE TABLE mastra_knowledge_unknown (id TEXT)',
    'CREATE TRIGGER custom_knowledge_trigger AFTER INSERT ON mastra_knowledge_nodes BEGIN SELECT 1; END',
    'CREATE VIEW unrelated_view AS SELECT * FROM mastra_knowledge_nodes',
  ])('rejects unknown or externally referenced v1 layouts without mutation: %s', async sql => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute(sql);
      const before = await client.execute('SELECT * FROM sqlite_master ORDER BY type, name');

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
      expect((await client.execute('SELECT * FROM sqlite_master ORDER BY type, name')).rows).toEqual(before.rows);
    } finally {
      client.close();
    }
  });

  it('preserves a commit response error after the transaction has closed', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v2-commit-response-'));
    const client = createClient({ url: `file:${join(directory, 'knowledge.db')}` });
    try {
      const primaryError = new Error('commit response failed');
      const transaction = client.transaction.bind(client);
      const transactionSpy = vi.spyOn(client, 'transaction').mockImplementation(async mode => {
        const tx = await transaction(mode);
        const commit = tx.commit.bind(tx);
        vi.spyOn(tx, 'commit').mockImplementation(async () => {
          await commit();
          throw primaryError;
        });
        return tx;
      });

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBe(primaryError);
      transactionSpy.mockRestore();
      expect(await new KnowledgeLibSQL({ client }).inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a complete Knowledge table set with a missing v2 column', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      await client.execute('ALTER TABLE mastra_knowledge_proposals DROP COLUMN reviewedAt');

      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
    } finally {
      client.close();
    }
  });

  it('rejects an interrupted v2 initialization without its completion marker', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      await client.execute(`DELETE FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);

      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
    } finally {
      client.close();
    }
  });

  it('persists normalized multi-scope node membership and record scope rules', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v2-normalized-'));
    const client = createClient({ url: `file:${join(directory, 'knowledge.db')}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const now = new Date().toISOString();
      for (const [id, name, address] of [
        ['scope-a', 'Scope A', 'org:a'],
        ['scope-b', 'Scope B', 'resource:b'],
      ] as const) {
        await client.execute({
          sql: `INSERT INTO mastra_knowledge_nodes (id,name,isScope,version,createdAt,updatedAt) VALUES (?,?,TRUE,1,?,?)`,
          args: [id, name, now, now],
        });
        await client.execute({
          sql: `INSERT INTO mastra_knowledge_scope_addresses (address,scopeNodeId) VALUES (?,?)`,
          args: [address, id],
        });
      }
      const scope = ['org:a', 'resource:b'];
      const node = await store.createNode({ id: 'node-a', name: 'Node A', kind: 'test', scope });
      const record = await store.appendKnowledge({
        id: 'record-a',
        node: node.id,
        text: 'scoped',
        scope,
        resolutionScope: scope,
        defaultScope: scope,
        sourceThreadId: 'thread-a',
      });

      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_node_scopes WHERE nodeId='node-a'`)).rows,
      ).toHaveLength(2);
      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_record_scopes WHERE recordId='record-a'`)).rows,
      ).toHaveLength(2);
      await store.updateNode({ id: node.id, version: node.version, scope: ['org:a'] });
      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_node_scopes WHERE nodeId='node-a'`)).rows,
      ).toEqual([expect.objectContaining({ scopeNodeId: 'scope-a' })]);
      expect(
        (
          await client.execute({
            sql: `SELECT targetType,targetId,contextScopeId FROM mastra_knowledge_activity WHERE targetId=?`,
            args: [record.id],
          })
        ).rows[0],
      ).toMatchObject({ targetType: 'record', targetId: record.id, contextScopeId: 'scope-a' });

      await store.rescopeKnowledge({ id: record.id, scope: ['org:a'] });
      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_record_scopes WHERE recordId='record-a'`)).rows,
      ).toEqual([expect.objectContaining({ scopeNodeId: 'scope-a' })]);
      expect(store.getCapabilities()).toMatchObject({ schemaVersion: 2, supportsV2: true });
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('claims outbox work once across concurrent store instances', async () => {
    const firstClient = createClient({ url: 'file::memory:?cache=shared' });
    const secondClient = createClient({ url: 'file::memory:?cache=shared' });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient });
      const second = new KnowledgeLibSQL({ client: secondClient });
      await Promise.all([first.init(), second.init()]);
      await first.dangerouslyClearAll();
      await first.createNode({ name: 'Concurrent', kind: 'task', scope: ['org:acme'] });
      const pending = await first.listSemanticOutbox({ status: 'pending' });
      const now = new Date(pending[0]!.availableAt.getTime() + 1);

      const [claimedFirst, claimedSecond] = await Promise.all([
        first.claimSemanticOutbox({ workerId: 'first', limit: 1, now }),
        second.claimSemanticOutbox({ workerId: 'second', limit: 1, now }),
      ]);

      expect([...claimedFirst, ...claimedSecond]).toHaveLength(1);
    } finally {
      firstClient.close();
      secondClient.close();
    }
  });

  it('queues curation cursor writes behind a locked transaction on the same client', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      await store.dangerouslyClearAll();

      let releaseLock!: () => void;
      const lockReleased = new Promise<void>(resolve => {
        releaseLock = resolve;
      });
      const lockedWrite = withClientWriteLock(client, async () => {
        const transaction = await client.transaction('write');
        await transaction.execute('SELECT 1');
        await lockReleased;
        await transaction.commit();
      });

      let cursorAdvanced = false;
      const advance = store
        .advanceCurationCursor({ sourceThreadId: 'thread-1', agent: 'capture', lastKnowledgeId: 'knowledge-1' })
        .then(() => {
          cursorAdvanced = true;
        });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cursorAdvanced).toBe(false);

      releaseLock();
      await Promise.all([lockedWrite, advance]);
      expect(await store.getCurationCursor({ sourceThreadId: 'thread-1', agent: 'capture' })).toEqual(
        expect.objectContaining({ lastKnowledgeId: 'knowledge-1' }),
      );
    } finally {
      client.close();
    }
  });

  it('is repeatable and adds knowledge tables to an existing store', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });
    try {
      await client.execute('CREATE TABLE IF NOT EXISTS existing_domain (id TEXT PRIMARY KEY)');
      await client.execute('DELETE FROM existing_domain');
      await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
      const store = new KnowledgeLibSQL({ client });

      await store.init();
      await store.init();

      const tables = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [TABLE_KNOWLEDGE_RECORDS],
      });
      expect(tables.rows).toHaveLength(1);
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
    } finally {
      client.close();
    }
  });
});
