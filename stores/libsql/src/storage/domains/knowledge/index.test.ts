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

describe('KnowledgeLibSQL name resolution', () => {
  it('does not load same-named nodes from scopes the caller cannot see', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      for (let index = 0; index < 20; index++) {
        await store.createNode({ name: 'Jane', kind: 'person', scope: ['org:acme', `resource:foreign-${index}`] });
      }
      const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: ['org:acme', 'resource:mastra'] });

      const execute = vi.spyOn(client, 'execute');
      await expect(
        store.resolveNode({ name: 'Jane', scope: ['org:acme', 'resource:mastra', 'thread:t1'] }),
      ).resolves.toMatchObject({ id: jane.id });

      // One candidate query plus one terminal lookup for the single visible candidate.
      expect(execute.mock.calls.length).toBeLessThanOrEqual(2);
    } finally {
      client.close();
    }
  });
});

describe('KnowledgeLibSQL initialization', () => {
  it('replaces the v1 tables every published LibSQL store created, discarding their rows', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute(
        `INSERT INTO mastra_knowledge_nodes (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES ('legacy','node','Legacy','legacy','task','legacy body','[]','legacy',1,NULL,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
      );
      await client.execute(
        "INSERT INTO mastra_knowledge_cursors (sourceThreadId, agent, lastKnowledgeId, updatedAt) VALUES ('thread', 'curate', 'k', '2026-01-01T00:00:00.000Z')",
      );
      await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");

      const store = new KnowledgeLibSQL({ client });
      await store.init();

      expect(await store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%'",
      );
      expect(new Set(tables.rows.map(row => String(row.name)))).toEqual(new Set(KNOWLEDGE_TABLE_NAMES));
      expect((await client.execute('SELECT id FROM mastra_knowledge_nodes')).rows).toEqual([]);
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
    } finally {
      client.close();
    }
  });

  it('opens Knowledge through the store on a database an earlier release initialized', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v1-upgrade-'));
    const url = `file:${join(directory, 'mastra.db')}`;
    const client = createClient({ url });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute(
        `INSERT INTO mastra_knowledge_nodes (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES ('legacy','node','Legacy','legacy','task','legacy body','[]','legacy',1,NULL,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
      );
      const store = new LibSQLStore({ id: 'upgraded', url });
      await store.init();

      const knowledge = await store.getStore('knowledge');
      expect(await knowledge?.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      expect(await knowledge?.getNode('legacy')).toBeNull();
      await store.close();
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('names the reset call when the Knowledge layout is not one Mastra published', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute('CREATE INDEX custom_knowledge_index ON mastra_knowledge_nodes (name)');
      await client.execute(
        "INSERT INTO mastra_knowledge_cursors (sourceThreadId, agent, lastKnowledgeId, updatedAt) VALUES ('thread', 'curate', 'k', '2026-01-01T00:00:00.000Z')",
      );

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toThrow(
        'await storage.stores?.knowledge?.dangerouslyReset()',
      );
      expect((await client.execute('SELECT agent FROM mastra_knowledge_cursors')).rows).toHaveLength(1);
    } finally {
      client.close();
    }
  });

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

  it('keeps working on v2 tables created while records still had a maxScope column', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await new KnowledgeLibSQL({ client }).init();
      await client.execute('ALTER TABLE mastra_knowledge_records ADD COLUMN maxScope TEXT');

      const store = new KnowledgeLibSQL({ client });
      expect(await store.inspectSchema()).toMatchObject({ status: 'compatible' });
      await store.init();
      const resource = ['org:acme', 'resource:mastra'];
      const node = await store.createNode({ name: 'Team practice', kind: 'task', scope: resource });
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'Reviews happen on Tuesdays',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: resource,
        defaultScope: resource,
      });
      await store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] });

      expect(await store.getKnowledge({ id: record.id })).toMatchObject({ scope: ['org:acme'] });
      const row = await client.execute({
        sql: 'SELECT maxScope FROM mastra_knowledge_records WHERE id=?',
        args: [record.id],
      });
      expect(row.rows[0]?.maxScope).toBeNull();
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

  it('reconciles structured scope plans additively and idempotently', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v2-reconcile-'));
    const client = createClient({ url: `file:${join(directory, 'knowledge.db')}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const plan = {
        scopes: [
          {
            address: 'org:acme',
            name: 'Acme',
            grants: [{ scopeRefAddress: 'org:acme', role: 'owner' as const }],
          },
          { address: 'org:partner', name: 'Partner' },
          {
            address: 'resource:mastra',
            name: 'Mastra',
            parentAddresses: ['org:acme'],
            grants: [{ scopeRefAddress: 'org:acme', role: 'readonly' as const }],
          },
        ],
      };

      const first = await store.reconcileStructure(plan);
      const second = await store.reconcileStructure({
        scopes: plan.scopes.map(scope => ({ ...scope, name: `Changed ${scope.name}` })),
      });

      expect(first).toMatchObject({ changed: true, accessEpoch: 1 });
      expect(first.createdScopeIds).toHaveLength(3);
      expect(second).toMatchObject({ changed: false, accessEpoch: 1, scopes: first.scopes });
      expect(
        (await client.execute(`SELECT name FROM mastra_knowledge_nodes WHERE id='${first.scopes['org:acme']}'`))
          .rows[0],
      ).toMatchObject({ name: 'Acme' });
      expect((await client.execute(`SELECT * FROM mastra_knowledge_node_scopes`)).rows).toHaveLength(1);
      expect((await client.execute(`SELECT * FROM mastra_knowledge_scope_grants`)).rows).toHaveLength(2);

      const enriched = await store.reconcileStructure({
        scopes: plan.scopes.map(scope =>
          scope.address === 'resource:mastra'
            ? {
                ...scope,
                parentAddresses: ['org:acme', 'org:partner'],
                grants: [...(scope.grants ?? []), { scopeRefAddress: 'org:partner', role: 'readonly' as const }],
              }
            : scope,
        ),
      });
      expect(enriched).toMatchObject({ changed: true, createdScopeIds: [], accessEpoch: 2 });
      expect((await client.execute(`SELECT * FROM mastra_knowledge_node_scopes`)).rows).toHaveLength(2);
      expect((await client.execute(`SELECT * FROM mastra_knowledge_scope_grants`)).rows).toHaveLength(3);

      await client.execute({
        sql: `UPDATE mastra_knowledge_nodes SET deletedAt=? WHERE id=?`,
        args: [new Date().toISOString(), first.scopes['org:acme']!],
      });
      await expect(store.reconcileStructure(plan)).resolves.toMatchObject({
        changed: false,
        deletedScopeAddresses: ['org:acme'],
      });

      await expect(
        store.reconcileStructure({
          scopes: [
            {
              address: 'resource:rolled-back',
              name: 'Rolled Back',
              grants: [{ scopeRefAddress: 'org:missing', role: 'readonly' }],
            },
          ],
        }),
      ).rejects.toThrow('Knowledge grant scope does not exist: org:missing');
      expect(
        (await client.execute(`SELECT * FROM mastra_knowledge_scope_addresses WHERE address='resource:rolled-back'`))
          .rows,
      ).toHaveLength(0);
      expect(
        (await client.execute(`SELECT epoch FROM mastra_knowledge_access_state WHERE id='global'`)).rows[0],
      ).toMatchObject({
        epoch: 2,
      });
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reads structural scope nodes and members after reconciliation', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v2-scope-nodes-'));
    const client = createClient({ url: `file:${join(directory, 'knowledge.db')}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const plan = {
        scopes: [
          { address: 'org:acme', name: 'mastra' },
          { address: 'features', name: 'features', kind: 'domain', parentAddresses: ['org:acme'] },
          { address: 'repo:mastra', name: 'repo:mastra', parentAddresses: ['org:acme'] },
        ],
      };
      const { scopes } = await store.reconcileStructure(plan);

      const { scopes: nodes } = await store.listScopeNodes();
      expect(nodes.map(node => node.name)).toEqual(['features', 'mastra', 'repo:mastra']);
      const mastra = nodes.find(node => node.name === 'mastra')!;
      const features = nodes.find(node => node.name === 'features')!;
      expect(features).toMatchObject({ address: 'features', kind: 'domain', parentIds: [mastra.id] });
      expect(mastra).toMatchObject({ address: 'org:acme', parentIds: [] });
      expect(nodes.find(node => node.name === 'repo:mastra')).toMatchObject({ address: 'repo:mastra' });
      expect(Object.values(scopes)).toEqual(expect.arrayContaining([mastra.id, features.id]));

      const { members, hasMore } = await store.listScopeMembers({ scopeNodeId: mastra.id });
      expect(hasMore).toBe(false);
      expect(members.map(node => node.id).sort()).toEqual([features.id, scopes['repo:mastra']!].sort());
      expect(members.every(node => node.scope === null)).toBe(true);
      // A scope reconciled without a kind reads back as an empty kind, as in every adapter.
      expect(Object.fromEntries(members.map(node => [node.name, node.kind]))).toEqual({
        features: 'domain',
        'repo:mastra': '',
      });
      const firstPage = await store.listScopeMembers({ scopeNodeId: mastra.id, limit: 1 });
      expect(firstPage.members).toHaveLength(1);
      expect(firstPage.hasMore).toBe(true);
      const secondPage = await store.listScopeMembers({
        scopeNodeId: mastra.id,
        limit: 1,
        cursor: firstPage.nextCursor!,
      });
      expect(secondPage).toMatchObject({ hasMore: false, nextCursor: null });
      expect([...firstPage.members, ...secondPage.members].map(node => node.id).sort()).toEqual(
        [features.id, scopes['repo:mastra']!].sort(),
      );
      await expect(store.listScopeMembers({ scopeNodeId: features.id, cursor: firstPage.nextCursor! })).rejects.toThrow(
        'Knowledge scope member cursor does not match this query.',
      );

      // Content nodes never join structural scopes; deletion and unknown ids stay out of the read.
      await client.execute(`UPDATE mastra_knowledge_nodes SET deletedAt=? WHERE id=?`, [
        new Date().toISOString(),
        features.id,
      ]);
      const { scopes: afterDelete } = await store.listScopeNodes();
      expect(afterDelete.find(node => node.id === features.id)).toBeUndefined();
      await expect(store.listScopeMembers({ scopeNodeId: crypto.randomUUID() })).resolves.toEqual({
        members: [],
        hasMore: false,
        nextCursor: null,
      });
    } finally {
      client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('serializes reconciliation across clients sharing one database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-v2-reconcile-concurrent-'));
    const url = `file:${join(directory, 'knowledge.db')}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient });
      const second = new KnowledgeLibSQL({ client: secondClient });
      await first.init();
      await second.init();
      const plan = { scopes: [{ address: 'org:acme', name: 'Acme' }] };

      const results = await Promise.all([first.reconcileStructure(plan), second.reconcileStructure(plan)]);

      expect(results.map(result => result.changed).sort()).toEqual([false, true]);
      expect(results[0]!.scopes).toEqual(results[1]!.scopes);
      expect((await firstClient.execute(`SELECT * FROM mastra_knowledge_scope_addresses`)).rows).toHaveLength(1);
    } finally {
      firstClient.close();
      secondClient.close();
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

  it('queues Knowledge writes behind a locked transaction on the same client', async () => {
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

      let nodeCreated = false;
      const create = store.createNode({ name: 'Queued write', kind: 'task', scope: ['org:acme'] }).then(node => {
        nodeCreated = true;
        return node;
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(nodeCreated).toBe(false);

      releaseLock();
      const [, node] = await Promise.all([lockedWrite, create]);
      expect(await store.getNode(node.id)).toEqual(expect.objectContaining({ name: 'Queued write' }));
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

describe('KnowledgeLibSQL indexes', () => {
  it('resolves node names through an index instead of scanning every node', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await new KnowledgeLibSQL({ client }).init();
      const plan = await client.execute(
        `EXPLAIN QUERY PLAN SELECT id FROM mastra_knowledge_nodes WHERE type='node' AND canonicalName='jane'`,
      );
      expect(plan.rows.map(row => String(row.detail)).join('\n')).toContain(
        'USING INDEX idx_knowledge_nodes_name (type=? AND canonicalName=?)',
      );
    } finally {
      client.close();
    }
  });
});
