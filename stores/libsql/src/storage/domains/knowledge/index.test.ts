import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKnowledgeSchemaLatchTests, createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import {
  InMemoryStore,
  knowledgeImporterBindingKey,
  KnowledgeSchemaError,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../..';
import { withClientWriteLock } from '../../db/write-lock';
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

describe('InMemory canonical parity', () => {
  let storage: InMemoryStore;
  createKnowledgeStorageTests(async reopen => {
    if (!reopen) storage = new InMemoryStore();
    return (await storage.getStore('knowledge'))!;
  });
});

const fixtures: { client: ReturnType<typeof createClient>; path: string }[] = [];
createKnowledgeStorageTests(reopen => {
  const path = reopen ? fixtures.at(-1)!.path : join(tmpdir(), `mastra-knowledge-contract-${randomUUID()}.db`);
  const client = createClient({ url: `file:${path}` });
  fixtures.push({ client, path });
  return new KnowledgeLibSQL({ client });
});
createKnowledgeSchemaLatchTests(async () => {
  const path = join(tmpdir(), `mastra-knowledge-latch-${randomUUID()}.db`);
  const client = createClient({ url: `file:${path}` });
  fixtures.push({ client, path });
  await client.execute('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY, name TEXT)');
  await client.execute("INSERT INTO mastra_knowledge_nodes (id, name) VALUES ('old', 'Old')");
  return {
    store: new KnowledgeLibSQL({ client }),
    repair: async () => {
      await client.execute('DROP TABLE mastra_knowledge_nodes');
    },
  };
});
afterEach(async () => {
  for (const { client, path } of fixtures.splice(0)) {
    client.close();
    await rm(path, { force: true });
  }
});

describe('KnowledgeLibSQL atomic node and record creation', () => {
  it('rolls back every Knowledge table when record outbox insertion fails after mentions are written', async () => {
    const path = join(tmpdir(), `mastra-knowledge-atomic-${randomUUID()}.db`);
    const client = createClient({ url: `file:${path}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const scopeId = '10000000-0000-4000-8000-000000000001';
      await store.createNode({ id: scopeId, name: 'Atomic scope', isScope: true, scopeIds: [] });
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mastra_knowledge_%' ORDER BY name",
      );
      const snapshot = async () =>
        Promise.all(
          tables.rows.map(async row => ({
            name: row.name,
            rows: (await client.execute(`SELECT * FROM "${row.name}" ORDER BY rowid`)).rows,
          })),
        );
      const before = await snapshot();
      await client.execute(
        `CREATE TRIGGER fail_record_outbox BEFORE INSERT ON mastra_knowledge_semantic_outbox WHEN NEW.documentType = 'record' BEGIN SELECT RAISE(ABORT, 'injected record outbox failure'); END`,
      );
      await expect(
        store.createNodeWithRecord({
          node: { name: 'Rollback subject', scopeIds: [scopeId] },
          record: {
            text: '[[Rollback mention]]',
            source: 'curator',
            metadata: { sourceThreadId: 'thread-a' },
            scopeIds: [scopeId],
          },
        }),
      ).rejects.toThrow('injected record outbox failure');
      expect(await snapshot()).toEqual(before);
    } finally {
      client.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL transaction errors', () => {
  it('preserves a commit response error after the transaction has closed', async () => {
    const path = join(tmpdir(), `mastra-knowledge-commit-${randomUUID()}.db`);
    const client = createClient({ url: `file:${path}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
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

      await expect(store.createNode({ name: 'Committed anyway', scopeIds: [] })).rejects.toBe(primaryError);
      transactionSpy.mockRestore();
      const rows = await client.execute("SELECT id FROM mastra_knowledge_nodes WHERE name='Committed anyway'");
      expect(rows.rows).toHaveLength(1);
    } finally {
      client.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL bounded node reads', () => {
  it('reads visible nodes in one query instead of loading every same-named node', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const visibleScope = await store.createNode({ name: 'Visible scope', isScope: true, scopeIds: [] });
      for (let index = 0; index < 20; index++) {
        const foreign = await store.createNode({ name: `Foreign ${index}`, isScope: true, scopeIds: [] });
        await store.createNode({ name: 'Jane', kind: 'person', scopeIds: [foreign.id] });
      }
      const jane = await store.createNode({ name: 'Jane', kind: 'person', scopeIds: [visibleScope.id] });
      const node = await store.createNode({ name: 'Cobalt runbook', scopeIds: [visibleScope.id] });
      await store.createRecord({ node, text: 'Cobalt rollout steps.', scopeIds: [visibleScope.id] });

      const execute = vi.spyOn(client, 'execute');
      await expect(store.resolveNode({ name: 'Jane', scopeIds: [visibleScope.id] })).resolves.toMatchObject({
        id: jane.id,
      });
      expect(execute).toHaveBeenCalledTimes(1);

      execute.mockClear();
      expect((await store.listNodes({ scopeIds: [visibleScope.id], namePrefix: 'jane' })).map(n => n.id)).toEqual([
        jane.id,
      ]);
      expect(execute).toHaveBeenCalledTimes(1);

      execute.mockClear();
      const results = await store.search({ query: 'cobalt', scopeIds: [visibleScope.id] });
      expect(results.map(result => result.type)).toEqual(['node', 'record']);
      // One query per result kind plus one membership read per returned result, never per stored row.
      expect(execute.mock.calls.length).toBeLessThanOrEqual(4);
    } finally {
      client.close();
    }
  });
});

describe('KnowledgeLibSQL replacement rollback', () => {
  it.each(['second-page', 'outbox', 'commit'])('restores every Knowledge table after %s failure', async stage => {
    const path = join(tmpdir(), `mastra-replacement-${randomUUID()}.db`);
    const client = createClient({ url: `file:${path}` });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const scopeId = randomUUID();
      await store.createNode({ id: scopeId, name: 'Scope', isScope: true, scopeIds: [] });
      const node = await store.createNode({ name: 'Document', scopeIds: [scopeId] });
      await store.setNodeAddress({ source: 'importer', address: 'document:1', nodeId: node.id });
      for (let index = 0; index < 105; index++)
        await store.createRecord({
          id: `prior-${String(index).padStart(3, '0')}`,
          node,
          text: 'Original [[Existing link]]',
          source: 'curator',
          scopeIds: [scopeId],
          metadata: { sourceThreadId: 'original' },
        });
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mastra_knowledge_%' ORDER BY name",
      );
      const snapshot = async () =>
        Promise.all(
          tables.rows.map(async row => ({
            name: row.name,
            rows: (await client.execute(`SELECT * FROM "${row.name}" ORDER BY rowid`)).rows,
          })),
        );
      const before = await snapshot();
      if (stage === 'second-page')
        await client.execute(
          `CREATE TRIGGER fail_page BEFORE UPDATE OF deletedAt ON mastra_knowledge_records WHEN NEW.id='prior-100' BEGIN SELECT RAISE(ABORT, 'injected second-page failure'); END`,
        );
      if (stage === 'outbox')
        await client.execute(
          `CREATE TRIGGER fail_outbox BEFORE INSERT ON mastra_knowledge_semantic_outbox WHEN NEW.documentId='knowledge:record:replacement' BEGIN SELECT RAISE(ABORT, 'injected outbox failure'); END`,
        );
      if (stage === 'commit') {
        await client.execute('PRAGMA foreign_keys=ON');
        await client.execute('CREATE TABLE failure_parent (id TEXT PRIMARY KEY)');
        await client.execute(
          'CREATE TABLE failure_child (id TEXT REFERENCES failure_parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        await client.execute(
          `CREATE TRIGGER fail_commit AFTER INSERT ON mastra_knowledge_records WHEN NEW.id='replacement' BEGIN INSERT INTO failure_child VALUES ('missing'); END`,
        );
      }
      await expect(
        store.replaceNodeRecords({
          node: { id: node.id, version: node.version },
          record: {
            id: 'replacement',
            text: 'Replacement [[New link]]',
            source: 'curator',
            scopeIds: [scopeId],
            metadata: { sourceThreadId: 'new' },
          },
          visibilityScopeIds: [scopeId],
        }),
      ).rejects.toThrow(stage === 'commit' ? /FOREIGN KEY/ : `injected ${stage} failure`);
      expect(await snapshot()).toEqual(before);
    } finally {
      client.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL schema completion marker', () => {
  it('writes the marker only after canonical initialization succeeds', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await new KnowledgeLibSQL({ client }).init();
      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
    } finally {
      client.close();
    }
  });

  it('rejects a markerless partial schema without mutating it', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await client.execute('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY)');
      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%' ORDER BY name",
      );
      expect(tables.rows.map(row => row.name)).toEqual(['mastra_knowledge_nodes']);
    } finally {
      client.close();
    }
  });
  it('explicitly resets retired Knowledge tables and leaves other storage untouched', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await client.execute('CREATE TABLE mastra_knowledge_cursors (id TEXT PRIMARY KEY)');
      await client.execute('CREATE TABLE mastra_threads (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO mastra_threads (id) VALUES ('preserved')");
      const store = new KnowledgeLibSQL({ client });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      await store.dangerouslyReset();

      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%'",
      );
      const names = tables.rows.map(row => String(row.name));
      expect(names).not.toContain('mastra_knowledge_cursors');
      expect(names).toContain(TABLE_KNOWLEDGE_SCHEMA);
      const threads = await client.execute('SELECT id FROM mastra_threads');
      expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
      await new KnowledgeLibSQL({ client }).init();
    } finally {
      client.close();
    }
  });
});

async function seedPublishedKnowledgeV1(
  client: ReturnType<typeof createClient>,
  fixture = 'published-1.21.1.sql',
): Promise<void> {
  const sql = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
  await client.batch(
    sql
      .split(';')
      .map(statement =>
        statement
          .split('\n')
          .filter(line => !line.startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter(Boolean),
    'write',
  );
}

async function knowledgeObjects(client: ReturnType<typeof createClient>): Promise<string[]> {
  const objects = await client.execute(
    "SELECT type || ':' || name AS object FROM sqlite_master WHERE name LIKE 'mastra_knowledge_%' OR name LIKE 'idx_knowledge_%' OR type = 'view' ORDER BY object",
  );
  return objects.rows.map(row => String(row.object));
}

describe('KnowledgeLibSQL published v1 layout', () => {
  it('replaces the empty tables every published LibSQL store created and keeps other storage', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute('CREATE TABLE mastra_threads (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO mastra_threads (id) VALUES ('preserved')");

      await new KnowledgeLibSQL({ client }).init();

      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
      expect(await knowledgeObjects(client)).not.toContain('table:mastra_knowledge_cursors');
      const threads = await client.execute('SELECT id FROM mastra_threads');
      expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
    } finally {
      client.close();
    }
  });

  it('replaces a published layout that holds rows, discarding them and keeping other storage', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute(
        "INSERT INTO mastra_knowledge_nodes (id,type,name,canonicalName,scope,scopeKey,version,createdAt,updatedAt) VALUES ('legacy','node','Legacy','legacy','[]','legacy',1,'2026-01-01','2026-01-01')",
      );
      await client.execute('CREATE TABLE mastra_threads (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO mastra_threads (id) VALUES ('preserved')");

      await new KnowledgeLibSQL({ client }).init();

      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
      expect((await client.execute("SELECT id FROM mastra_knowledge_nodes WHERE id = 'legacy'")).rows).toEqual([]);
      const threads = await client.execute('SELECT id FROM mastra_threads');
      expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
    } finally {
      client.close();
    }
  });

  it('rejects a published layout that another object depends on', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute('CREATE VIEW host_report AS SELECT id FROM mastra_knowledge_nodes');
      const before = await knowledgeObjects(client);

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      expect(await knowledgeObjects(client)).toEqual(before);
    } finally {
      client.close();
    }
  });

  it('opens Knowledge through the store on a database an earlier release initialized', async () => {
    const path = join(tmpdir(), `mastra-knowledge-v1-upgrade-${randomUUID()}.db`);
    const client = createClient({ url: `file:${path}` });
    const store = new LibSQLStore({ id: 'upgraded', url: `file:${path}` });
    try {
      await seedPublishedKnowledgeV1(client);
      await store.init();

      await store.getStore('knowledge');

      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
    } finally {
      await store.close();
      client.close();
      await rm(path, { force: true });
    }
  });

  it('rejects a published layout missing one of its tables', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client);
      await client.execute('DROP TABLE mastra_knowledge_mentions');
      const before = await knowledgeObjects(client);

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      expect(await knowledgeObjects(client)).toEqual(before);
    } finally {
      client.close();
    }
  });
});

describe('KnowledgeLibSQL shared access epochs', () => {
  it('serializes concurrent grant reconciliation across clients', async () => {
    const path = join(tmpdir(), `mastra-knowledge-access-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const plan = {
        scopes: [
          { address: 'principal:shared', name: 'Shared principal' },
          {
            address: 'project:shared',
            name: 'Shared project',
            grants: [{ scopeRefAddress: 'principal:shared', role: 'edit' as const }],
          },
        ],
      };

      const [left, right] = await Promise.all([first.reconcileStructure(plan), second.reconcileStructure(plan)]);

      expect(left.scopes).toEqual(right.scopes);
      expect([left.changed, right.changed].sort()).toEqual([false, true]);
      expect(await first.getAccessEpoch()).toBe(1);
      expect(await second.getAccessEpoch()).toBe(1);
      expect(await second.listScopeGrants()).toEqual([
        {
          scopeNodeId: left.scopes['project:shared'],
          scopeRefId: left.scopes['principal:shared'],
          role: 'edit',
          canSuggest: undefined,
        },
      ]);

      const withRole = (role: 'append' | 'owner') => ({
        scopes: [
          { address: 'principal:shared', name: 'Shared principal' },
          {
            address: 'project:shared',
            name: 'Shared project',
            grants: [{ scopeRefAddress: 'principal:shared', role }],
          },
        ],
      });
      const [appendResult, ownerResult] = await Promise.all([
        first.reconcileStructure(withRole('append')),
        second.reconcileStructure(withRole('owner')),
      ]);
      const finalRole = appendResult.accessEpoch > ownerResult.accessEpoch ? 'append' : 'owner';
      expect([appendResult.accessEpoch, ownerResult.accessEpoch].sort()).toEqual([2, 3]);
      expect(await first.getAccessEpoch()).toBe(3);
      expect(await first.listScopeGrants()).toEqual([
        {
          scopeNodeId: left.scopes['project:shared'],
          scopeRefId: left.scopes['principal:shared'],
          role: finalRole,
          canSuggest: undefined,
        },
      ]);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL semantic outbox claims', () => {
  it('claims disjoint visible scopes without scanning or claiming a hidden backlog', async () => {
    const path = join(tmpdir(), `mastra-knowledge-outbox-scopes-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const firstScopeId = randomUUID();
      const secondScopeId = randomUUID();
      await first.createNode({ id: firstScopeId, name: 'First claim scope', isScope: true, scopeIds: [] });
      await first.createNode({ id: secondScopeId, name: 'Second claim scope', isScope: true, scopeIds: [] });
      for (let index = 0; index < 150; index++) {
        await first.createNode({ name: `Second hidden subject ${index}`, scopeIds: [secondScopeId] });
      }
      const firstSubject = await first.createNode({ name: 'First visible subject', scopeIds: [firstScopeId] });

      const [firstClaim, secondClaim] = await Promise.all([
        first.claimSemanticOutbox({ workerId: 'first-scope-worker', scopeIds: [firstScopeId], limit: 1 }),
        second.claimSemanticOutbox({ workerId: 'second-scope-worker', scopeIds: [secondScopeId], limit: 1 }),
      ]);

      expect(firstClaim).toHaveLength(1);
      expect(firstClaim[0]?.documentId).toContain(firstSubject.id);
      expect(secondClaim).toHaveLength(1);
      expect(secondClaim[0]?.scopeIds).toEqual([secondScopeId]);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });

  it('claims each entry through only one client', async () => {
    const path = join(tmpdir(), `mastra-knowledge-outbox-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const scopeId = randomUUID();
      await first.createNode({ id: scopeId, name: 'Claim scope', isScope: true, scopeIds: [] });
      await first.createNode({ name: 'Claim subject', scopeIds: [scopeId] });

      const now = new Date();
      const [firstClaim, secondClaim] = await Promise.all([
        first.claimSemanticOutbox({ workerId: 'worker-1', now }),
        second.claimSemanticOutbox({ workerId: 'worker-2', now }),
      ]);
      const claimedIds = [...firstClaim, ...secondClaim].map(entry => entry.id);
      expect(claimedIds.length).toBeGreaterThan(0);
      expect(new Set(claimedIds).size).toBe(claimedIds.length);
      expect([firstClaim.length, secondClaim.length].filter(count => count > 0)).toHaveLength(1);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL importer run claims', () => {
  it('claims a binding through one client and fences heartbeats and finalization by worker', async () => {
    const path = join(tmpdir(), `mastra-knowledge-import-claim-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
      await first.enqueueImportRun({
        id: 'run-1',
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: '__mastra_internal/import-payload/run-1',
        payload: '{"payload":{"event":"first"}}',
      });
      await first.enqueueImportRun({
        id: 'run-2',
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: '__mastra_internal/import-payload/run-2',
        payload: '{"payload":{"event":"second"}}',
      });

      const [firstClaim, secondClaim] = await Promise.all([
        first.claimImportRun({ importerId: 'calendar', binding, workerId: 'worker-1', leaseKey: 'lease/' }),
        second.claimImportRun({ importerId: 'calendar', binding, workerId: 'worker-2', leaseKey: 'lease/' }),
      ]);
      const claimed = firstClaim ?? secondClaim;
      const owner = firstClaim ? 'worker-1' : 'worker-2';
      const other = firstClaim ? 'worker-2' : 'worker-1';
      const ownerStore = firstClaim ? first : second;
      const otherStore = firstClaim ? second : first;
      expect(claimed).toMatchObject({ id: 'run-1', status: 'running' });
      expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1);
      await expect(
        otherStore.heartbeatImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: other,
          leaseKey: 'lease/run-1',
        }),
      ).resolves.toBe(false);
      await expect(
        otherStore.finalizeImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: other,
          leaseKey: 'lease/run-1',
          status: 'succeeded',
          state: [{ key: 'cursor', value: 'forged' }],
        }),
      ).resolves.toBeNull();
      await expect(
        ownerStore.finalizeImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: owner,
          leaseKey: 'lease/run-1',
          status: 'succeeded',
          state: [{ key: 'cursor', value: 'first' }],
        }),
      ).resolves.toMatchObject({ status: 'succeeded' });
      await expect(
        otherStore.claimImportRun({ importerId: 'calendar', binding, workerId: other, leaseKey: 'lease/' }),
      ).resolves.toMatchObject({ id: 'run-2', status: 'running' });
      await expect(first.getImportState({ importerId: 'calendar', binding, key: 'cursor' })).resolves.toMatchObject({
        value: 'first',
      });
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });

  it('atomically skips overlapping cron enqueue across clients', async () => {
    const path = join(tmpdir(), `mastra-knowledge-import-cron-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
      const enqueue = (store: KnowledgeLibSQL, id: string) =>
        store.enqueueImportRun({
          id,
          importerId: 'calendar',
          binding,
          importKind: 'static',
          triggerKind: 'cron',
          payloadKey: `__mastra_internal/import-payload/${id}`,
          payload: '{}',
          skipIfActiveCron: true,
        });

      const runs = await Promise.all([enqueue(first, 'cron-1'), enqueue(second, 'cron-2')]);
      expect(runs.map(run => run.status).sort()).toEqual(['queued', 'skipped']);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });
});

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

describe('KnowledgeLibSQL shared-database concurrency', () => {
  it('claims outbox work once across concurrent store instances', async () => {
    const path = join(tmpdir(), `mastra-knowledge-claim-${randomUUID()}.db`);
    const firstClient = createClient({ url: `file:${path}` });
    const secondClient = createClient({ url: `file:${path}` });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient });
      const second = new KnowledgeLibSQL({ client: secondClient });
      await first.init();
      await second.init();
      const scope = await first.createNode({ name: 'Scope', isScope: true, scopeIds: [] });
      await first.createNode({ name: 'Concurrent', kind: 'task', scopeIds: [scope.id] });
      const pending = await first.listSemanticOutbox({ status: 'pending' });
      expect(pending.length).toBeGreaterThan(0);
      const now = new Date(Math.max(...pending.map(entry => entry.availableAt.getTime())) + 1);

      const [claimedFirst, claimedSecond] = await Promise.all([
        first.claimSemanticOutbox({ workerId: 'first', limit: 100, now }),
        second.claimSemanticOutbox({ workerId: 'second', limit: 100, now }),
      ]);

      const claimedIds = [...claimedFirst, ...claimedSecond].map(entry => entry.id);
      expect([...claimedIds].sort()).toEqual(pending.map(entry => entry.id).sort());
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });

  it('queues Knowledge writes behind a locked transaction on the same client', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const scope = await store.createNode({ name: 'Scope', isScope: true, scopeIds: [] });

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
      const create = store.createNode({ name: 'Queued write', kind: 'task', scopeIds: [scope.id] }).then(node => {
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
});

describe('KnowledgeLibSQL interim canonical-model layout', () => {
  const INTERIM_FIXTURE = 'interim-1.76.0-alpha.3.sql';

  it('replaces the layout the interim release created, discarding its rows and keeping other storage', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client, INTERIM_FIXTURE);
      await client.execute(
        "INSERT INTO mastra_knowledge_semantic_outbox (id,idempotencyKey,documentId,documentType,operation,scope,scopeKey,status,attempts,availableAt,createdAt) VALUES ('legacy','legacy','legacy','node','upsert','[]','legacy','completed',1,'2026-10-01','2026-10-01')",
      );
      await client.execute('CREATE TABLE mastra_threads (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO mastra_threads (id) VALUES ('preserved')");

      await new KnowledgeLibSQL({ client }).init();

      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
      expect((await client.execute('SELECT id FROM mastra_knowledge_semantic_outbox')).rows).toEqual([]);
      const nodeColumns = await client.execute('PRAGMA table_info("mastra_knowledge_nodes")');
      expect(nodeColumns.rows.map(row => String(row.name))).not.toContain('canonicalName');
      const threads = await client.execute('SELECT id FROM mastra_threads');
      expect(threads.rows.map(row => row.id)).toEqual(['preserved']);
      await new KnowledgeLibSQL({ client }).init();
    } finally {
      client.close();
    }
  });

  it('leaves a modified interim layout untouched', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client, INTERIM_FIXTURE);
      await client.execute('ALTER TABLE mastra_knowledge_nodes ADD COLUMN host_note TEXT');
      const before = await knowledgeObjects(client);

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      expect(await knowledgeObjects(client)).toEqual(before);
    } finally {
      client.close();
    }
  });

  it('leaves an interim layout with an unfamiliar index untouched', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client, INTERIM_FIXTURE);
      await client.execute('CREATE INDEX host_index ON mastra_knowledge_records (text)');
      const before = await knowledgeObjects(client);

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      expect(await knowledgeObjects(client)).toEqual(before);
    } finally {
      client.close();
    }
  });

  it.each(['snapshot-w1-20261006001735.sql', 'snapshot-w1-20261007232522.sql'])(
    'replaces the layout published snapshot %s created, discarding its rows',
    async fixture => {
      const client = createClient({ url: ':memory:' });
      try {
        await seedPublishedKnowledgeV1(client, fixture);
        await client.execute(
          "INSERT INTO mastra_knowledge_semantic_outbox (id,idempotencyKey,documentId,documentType,operation,scope,scopeKey,status,attempts,availableAt,createdAt) VALUES ('legacy','legacy','legacy','node','upsert','[]','legacy','completed',1,'2026-10-01','2026-10-01')",
        );

        await new KnowledgeLibSQL({ client }).init();

        expect((await client.execute('SELECT id FROM mastra_knowledge_semantic_outbox')).rows).toEqual([]);
        const tables = await client.execute(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mastra_knowledge_cursors'",
        );
        expect(tables.rows).toEqual([]);
        await new KnowledgeLibSQL({ client }).init();
      } finally {
        client.close();
      }
    },
  );

  it('replaces an early-snapshot layout that later interim builds re-initialized', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client, 'snapshot-w1-20261006001735.sql');
      // Later builds added these indexes with IF NOT EXISTS but never dropped the early columns or table.
      await client.execute('CREATE INDEX idx_knowledge_nodes_name ON mastra_knowledge_nodes (type, canonicalName)');
      await client.execute('CREATE INDEX idx_knowledge_records_scope ON mastra_knowledge_records (scopeKey, id)');
      await client.execute(
        'CREATE INDEX idx_knowledge_activity_scope ON mastra_knowledge_activity (scopeKey, id DESC)',
      );

      await new KnowledgeLibSQL({ client }).init();

      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
    } finally {
      client.close();
    }
  });

  it('leaves a layout mixing snapshot shapes untouched', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seedPublishedKnowledgeV1(client, 'snapshot-w1-20261007232522.sql');
      await client.execute('ALTER TABLE mastra_knowledge_records ADD COLUMN nodeId TEXT');
      const before = await knowledgeObjects(client);

      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      expect(await knowledgeObjects(client)).toEqual(before);
    } finally {
      client.close();
    }
  });
});
