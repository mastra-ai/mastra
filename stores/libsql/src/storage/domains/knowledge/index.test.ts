import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import {
  InMemoryStore,
  knowledgeImporterBindingKey,
  KnowledgeSchemaError,
  MastraCompositeStore,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../..';
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
afterAll(async () => {
  for (const { client, path } of fixtures) {
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

describe('LibSQLStore explicit Knowledge activation', () => {
  it('preserves private in-memory Knowledge and unrelated data across transactions', async () => {
    const client = createClient({ url: ':memory:' });
    const adapter = new LibSQLStore({ id: 'private-memory', client });
    try {
      await client.execute('CREATE TABLE sentinel (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO sentinel VALUES ('preserve')");
      const knowledge = await adapter.getStore('knowledge');
      expect(knowledge).toBeDefined();
      const scope = await knowledge!.createNode({ name: 'Private scope', isScope: true, scopeIds: [] });
      expect((await client.execute('SELECT id FROM sentinel')).rows).toEqual([{ id: 'preserve' }]);
      const node = await knowledge!.createNode({ name: 'Subject', scopeIds: [scope.id] });
      expect(
        (await client.execute({ sql: 'SELECT name FROM mastra_knowledge_nodes WHERE id=?', args: [node.id] })).rows,
      ).toEqual([{ name: 'Subject' }]);
    } finally {
      await adapter.close();
    }
  });

  it('retains native interactive mutations for a supplied file-backed client', async () => {
    const file = join(tmpdir(), `knowledge-native-${randomUUID()}.db`);
    const client = createClient({ url: `file:${file}` });
    const knowledge = new KnowledgeLibSQL({ client });
    try {
      await knowledge.init();
      const transaction = vi.spyOn(client, 'transaction');
      await knowledge.createNode({ name: 'File scope', isScope: true, scopeIds: [] });
      expect(transaction).toHaveBeenCalledWith('write');
      transaction.mockRestore();
    } finally {
      client.close();
      await Promise.all([file, `${file}-wal`, `${file}-shm`].map(path => rm(path, { force: true })));
    }
  });

  it('keeps separate private in-memory clients isolated', async () => {
    const clients = [createClient({ url: ':memory:' }), createClient({ url: ':memory:' })];
    const first = new KnowledgeLibSQL({ client: clients[0]! });
    const second = new KnowledgeLibSQL({ client: clients[1]! });
    try {
      await Promise.all([first.init(), second.init()]);
      const node = await first.createNode({ name: 'Only first', isScope: true, scopeIds: [] });
      expect(await first.getNode(node.id)).toMatchObject({ name: 'Only first' });
      expect(await second.getNode(node.id)).toBeNull();
    } finally {
      clients.forEach(client => client.close());
    }
  });

  it('blocks in-memory readers until a failed write rolls back without exposing partial state', async () => {
    const client = createClient({ url: ':memory:' });
    const knowledge = new KnowledgeLibSQL({ client });
    await knowledge.init();
    const scope = await knowledge.createNode({ name: 'Scope', isScope: true, scopeIds: [] });
    const id = randomUUID();
    let release = () => {};
    let inserted = () => {};
    const paused = new Promise<void>(resolve => {
      release = resolve;
    });
    const reachedInsert = new Promise<void>(resolve => {
      inserted = resolve;
    });
    const transaction = client.transaction.bind(client);
    const spy = vi.spyOn(client, 'transaction').mockImplementation(async mode => {
      const tx = await transaction(mode);
      const execute = tx.execute.bind(tx);
      vi.spyOn(tx, 'execute').mockImplementation(async statement => {
        const result = await execute(statement);
        const sql = typeof statement === 'string' ? statement : statement.sql;
        if (sql.startsWith('INSERT INTO "mastra_knowledge_nodes"')) {
          inserted();
          await paused;
          throw new Error('Injected post-insert failure');
        }
        return result;
      });
      return tx;
    });
    try {
      const mutation = expect(knowledge.createNode({ id, name: 'Rollback', scopeIds: [scope.id] })).rejects.toThrow(
        'Injected post-insert failure',
      );
      await reachedInsert;
      let readFinished = false;
      const reading = knowledge.getNode(id).then(node => {
        readFinished = true;
        return node;
      });
      await new Promise(resolve => setImmediate(resolve));
      expect(readFinished).toBe(false);
      release();
      await mutation;
      expect(await reading).toBeNull();
      spy.mockRestore();
      expect((await knowledge.createNode({ name: 'After rollback', scopeIds: [scope.id] })).name).toBe(
        'After rollback',
      );
    } finally {
      release();
      spy.mockRestore();
      client.close();
    }
  });

  it.each([false, true])('does not create Knowledge objects during ordinary startup (composed=%s)', async composed => {
    const client = createClient({ url: ':memory:' });
    const adapter = new LibSQLStore({ id: 'ordinary', client });
    const store = composed ? new MastraCompositeStore({ id: 'composed', default: adapter }) : adapter;
    try {
      await store.init();
      expect(await store.getStore('memory')).toBeDefined();
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE name GLOB 'mastra_knowledge_*'");
      expect(tables.rows).toEqual([]);
      expect(await store.getStore('knowledge')).toBeDefined();
      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
    } finally {
      await store.close();
    }
  });

  it('leaves unknown Knowledge artifacts intact during startup and failed activation', async () => {
    const client = createClient({ url: ':memory:' });
    const store = new LibSQLStore({ id: 'unknown-artifacts', client });
    try {
      await client.execute('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY, payload TEXT)');
      await client.execute("INSERT INTO mastra_knowledge_nodes VALUES ('private', 'preserve')");
      await client.execute('CREATE TABLE knowledge_documents_dimension_3 (id TEXT PRIMARY KEY, payload TEXT)');
      await client.execute("INSERT INTO knowledge_documents_dimension_3 VALUES ('vector', 'preserve')");
      await store.init();
      const before = await client.execute('SELECT * FROM sqlite_master ORDER BY name');
      await expect(store.getStore('knowledge')).rejects.toBeInstanceOf(KnowledgeSchemaError);
      expect((await client.execute('SELECT * FROM sqlite_master ORDER BY name')).rows).toEqual(before.rows);
      expect((await client.execute('SELECT * FROM mastra_knowledge_nodes')).rows).toEqual([
        { id: 'private', payload: 'preserve' },
      ]);
      expect((await client.execute('SELECT * FROM knowledge_documents_dimension_3')).rows).toEqual([
        { id: 'vector', payload: 'preserve' },
      ]);
      await expect(store.init()).resolves.toBeUndefined();
      expect(await store.getStore('memory')).toBeDefined();
    } finally {
      await store.close();
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

describe('KnowledgeLibSQL recognized empty experimental schema', () => {
  const seed = async (client: ReturnType<typeof createClient>) => {
    const sql = await readFile(new URL('./fixtures/published-1.21.1.sql', import.meta.url), 'utf8');
    await client.batch(
      sql
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean),
      'write',
    );
  };

  it('replaces only the empty published layout and leaves vector state untouched', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seed(client);
      await client.execute('CREATE TABLE knowledge_documents_dimension_3 (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO knowledge_documents_dimension_3 VALUES ('untouched')");
      await Promise.all([new KnowledgeLibSQL({ client }).init(), new KnowledgeLibSQL({ client }).init()]);
      const columns = await client.execute('PRAGMA table_info(mastra_knowledge_nodes)');
      expect(columns.rows.map(row => row.name)).toContain('isScope');
      expect(columns.rows.map(row => row.name)).not.toContain('type');
      expect((await client.execute('SELECT * FROM knowledge_documents_dimension_3')).rows).toEqual([
        { id: 'untouched' },
      ]);
    } finally {
      client.close();
    }
  });

  it.each(['nodes', 'records', 'mentions', 'cursors', 'activity', 'semantic_outbox'])(
    'refuses replacement if %s contains data',
    async suffix => {
      const client = createClient({ url: ':memory:' });
      try {
        await seed(client);
        const table = `mastra_knowledge_${suffix}`;
        const columns = await client.execute(`PRAGMA table_info(${table})`);
        const names = columns.rows.map(row => `"${row.name}"`).join(',');
        await client.execute({
          sql: `INSERT INTO ${table} (${names}) VALUES (${columns.rows.map(() => '?').join(',')})`,
          args: columns.rows.map(row => (row.type === 'INTEGER' ? 1 : 'retained')),
        });
        const before = await client.execute('SELECT * FROM sqlite_master ORDER BY name');
        await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
        expect((await client.execute('SELECT * FROM sqlite_master ORDER BY name')).rows).toEqual(before.rows);
        expect((await client.execute(`SELECT * FROM ${table}`)).rows).toHaveLength(1);
      } finally {
        client.close();
      }
    },
  );

  it.each([
    'CREATE TABLE mastra_knowledge_unknown (id TEXT)',
    'CREATE TRIGGER custom_knowledge_trigger AFTER INSERT ON mastra_knowledge_nodes BEGIN SELECT 1; END',
    'CREATE VIEW unrelated_view AS SELECT * FROM mastra_knowledge_nodes',
  ])('rejects unrecognized or externally referenced layouts without mutation: %s', async sql => {
    const client = createClient({ url: ':memory:' });
    try {
      await seed(client);
      await client.execute(sql);
      const before = await client.execute('SELECT * FROM sqlite_master ORDER BY name');
      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
      expect((await client.execute('SELECT * FROM sqlite_master ORDER BY name')).rows).toEqual(before.rows);
    } finally {
      client.close();
    }
  });

  it('rolls back the empty legacy layout if canonical creation fails and permits a retry', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await seed(client);
      const before = await client.execute('SELECT * FROM sqlite_master ORDER BY name');
      const transaction = client.transaction.bind(client);
      const spy = vi.spyOn(client, 'transaction').mockImplementation(async mode => {
        const tx = await transaction(mode);
        const execute = tx.execute.bind(tx);
        vi.spyOn(tx, 'execute').mockImplementation(async statement => {
          const sql = typeof statement === 'string' ? statement : statement.sql;
          if (sql.startsWith('CREATE TABLE') && sql.includes('mastra_knowledge_schema')) {
            throw new Error('injected schema creation failure');
          }
          return execute(statement);
        });
        return tx;
      });
      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toThrow();
      spy.mockRestore();
      expect((await client.execute('SELECT * FROM sqlite_master ORDER BY name')).rows).toEqual(before.rows);
      await new KnowledgeLibSQL({ client }).init();
      expect((await client.execute(`SELECT * FROM ${TABLE_KNOWLEDGE_SCHEMA}`)).rows).toHaveLength(1);
    } finally {
      client.close();
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
});

describe('KnowledgeLibSQL shared access epochs', () => {
  it('reconciles one identity scope authority across restart without touching other principals', async () => {
    const path = join(tmpdir(), `mastra-knowledge-curator-profile-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      await first.init();
      const plan = await first.reconcileStructure({
        scopes: [
          { address: 'principal:curator', name: 'Curator' },
          { address: 'principal:host', name: 'Host' },
          { address: 'scope:a', name: 'A' },
          { address: 'scope:b', name: 'B' },
        ],
      });
      await first.reconcileScopeReferenceGrants({
        scopeRefId: plan.scopes['principal:curator']!,
        grants: [
          {
            scopeNodeId: plan.scopes['scope:a']!,
            scopeRefId: plan.scopes['principal:curator']!,
            role: 'owner',
          },
        ],
      });
      await first.upsertScopeGrant({
        scopeNodeId: plan.scopes['scope:a']!,
        scopeRefId: plan.scopes['principal:host']!,
        role: 'owner',
      });
      firstClient.close();

      const restartedClient = createClient({ url });
      try {
        const restarted = new KnowledgeLibSQL({ client: restartedClient, storageIsolationKey: url });
        await restarted.init();
        const changed = await restarted.reconcileScopeReferenceGrants({
          scopeRefId: plan.scopes['principal:curator']!,
          grants: [
            {
              scopeNodeId: plan.scopes['scope:b']!,
              scopeRefId: plan.scopes['principal:curator']!,
              role: 'owner',
            },
          ],
        });
        expect(changed.changed).toBe(true);
        expect(await restarted.listScopeGrants()).toEqual(
          expect.arrayContaining([
            {
              scopeNodeId: plan.scopes['scope:a'],
              scopeRefId: plan.scopes['principal:host'],
              role: 'owner',
              canSuggest: undefined,
            },
            {
              scopeNodeId: plan.scopes['scope:b'],
              scopeRefId: plan.scopes['principal:curator'],
              role: 'owner',
              canSuggest: undefined,
            },
          ]),
        );

        const epoch = await restarted.getAccessEpoch();
        await expect(
          restarted.reconcileScopeReferenceGrants({
            scopeRefId: plan.scopes['principal:curator']!,
            grants: [
              {
                scopeNodeId: randomUUID(),
                scopeRefId: plan.scopes['principal:curator']!,
                role: 'owner',
              },
            ],
          }),
        ).rejects.toBeDefined();
        expect(await restarted.getAccessEpoch()).toBe(epoch);
        expect(
          (await restarted.listScopeGrants()).find(grant => grant.scopeRefId === plan.scopes['principal:curator']),
        ).toMatchObject({ scopeNodeId: plan.scopes['scope:b'], role: 'owner' });
      } finally {
        restartedClient.close();
      }
    } finally {
      firstClient.close();
      await rm(path, { force: true });
    }
  });

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

      // Grant changes on an existing scope flow through the governed grant API; reconcile
      // seeds grants only when it creates the scope. Concurrent governed grant writes from
      // separate clients serialize on the shared file and advance one epoch each.
      const withRole = (role: 'append' | 'owner') => ({
        scopeNodeId: left.scopes['project:shared']!,
        scopeRefId: left.scopes['principal:shared']!,
        role,
      });
      const [appendResult, ownerResult] = await Promise.all([
        first.upsertScopeGrant(withRole('append')),
        second.upsertScopeGrant(withRole('owner')),
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

      // Re-materializing the seeded structure after those writes must not resurrect or
      // re-impose the original planned grant.
      const rematerialized = await first.reconcileStructure(plan);
      expect(rematerialized).toMatchObject({ changed: false, accessEpoch: 3 });
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
      for (let index = 0; index < 50; index++) {
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

  it('keeps outbox reads bounded when stale scope stamps overlap the caller but current visibility fails', async () => {
    const path = join(tmpdir(), `mastra-knowledge-outbox-stale-${randomUUID()}.db`);
    const url = `file:${path}`;
    const realClient = createClient({ url });
    let statements = 0;
    const client = new Proxy(realClient, {
      get(target, prop, receiver) {
        if (prop === 'execute') {
          const execute = target.execute.bind(target);
          return async (...args: Parameters<typeof execute>) => {
            statements += 1;
            return execute(...args);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    try {
      const store = new KnowledgeLibSQL({ client, storageIsolationKey: url });
      await store.init();
      const callerScopeId = randomUUID();
      const hiddenScopeId = randomUUID();
      await store.createNode({ id: callerScopeId, name: 'Caller scope', isScope: true, scopeIds: [] });
      await store.createNode({ id: hiddenScopeId, name: 'Hidden scope', isScope: true, scopeIds: [] });

      // Stale-overlap backlog: nodes enqueued under the caller scope, then
      // moved into the hidden scope. Their outbox rows keep the caller-stamped
      // scopeIds but current visibility fails, so the SQL predicate must
      // exclude them — without walking the whole table client-side.
      const staleEntries = 50;
      for (let index = 0; index < staleEntries; index++) {
        const node = await store.createNode({ name: `Stale subject ${index}`, scopeIds: [callerScopeId] });
        await store.updateNode({ id: node.id, version: node.version, scopeIds: [hiddenScopeId] });
      }
      // Mention-closure staleness: a visible record whose mentioned node moved
      // out of view keeps a caller-stamped row that current visibility fails.
      const mentionTarget = await store.createNode({ name: 'MentionTarget', scopeIds: [callerScopeId] });
      const owner = await store.createNode({ name: 'Record owner', scopeIds: [callerScopeId] });
      await store.createRecord({
        node: owner.id,
        text: 'See [[MentionTarget]] for details.',
        scopeIds: [callerScopeId],
      });
      await store.updateNode({
        id: mentionTarget.id,
        version: mentionTarget.version,
        scopeIds: [hiddenScopeId],
      });
      // The one entry that stays genuinely visible.
      const visible = await store.createNode({ name: 'Visible subject', scopeIds: [callerScopeId] });

      // Visible to the caller: the one live upsert plus the reindex `delete`
      // entries (stamped with the caller scope at move time) — never a stale
      // upsert whose current scope state is hidden.
      statements = 0;
      const listed = await store.listSemanticOutbox({ scopeIds: [callerScopeId], limit: 200 });
      expect(listed).toHaveLength(53);
      for (const entry of listed) {
        if (entry.operation === 'upsert') {
          // the live node plus the record-owner node are the only visible upserts
          expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
        } else {
          expect(entry.operation).toBe('delete');
        }
      }
      expect(statements).toBe(1);

      statements = 0;
      const claimed = await store.claimSemanticOutbox({
        workerId: 'stale-worker',
        scopeIds: [callerScopeId],
        limit: 5,
      });
      // reindex deletes queue behind their stale (filtered) upserts, so only
      // the two legitimate upserts are claimable — the stale backlog is never
      // walked client-side
      expect(claimed).toHaveLength(2);
      for (const entry of claimed) {
        expect(entry.operation).toBe('upsert');
        expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
      }
      // one bounded SELECT plus one guarded claim UPDATE per row — no scan loop
      expect(statements).toBeLessThanOrEqual(3);
    } finally {
      realClient.close();
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
});
