import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import {
  KNOWLEDGE_TABLE_NAMES,
  KnowledgeSchemaResetRequiredError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_RECORDS,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { withClientWriteLock } from '../../db/write-lock';
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

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

describe('KnowledgeLibSQL initialization', () => {
  it('detects legacy tables without mutation and resets only Knowledge storage', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
      await client.execute("INSERT INTO existing_domain (id) VALUES ('preserved')");
      await client.execute(
        `CREATE TABLE "mastra_knowledge_nodes" (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          canonicalName TEXT NOT NULL,
          kind TEXT,
          content TEXT,
          scope TEXT NOT NULL,
          scopeKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          mergedInto TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`,
      );
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
      expect(await store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
      expect((await client.execute('SELECT content FROM mastra_knowledge_nodes')).rows[0]?.content).toBe('legacy body');

      await store.dangerouslyReset();
      expect(await store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      expect((await client.execute('SELECT id FROM existing_domain')).rows[0]?.id).toBe('preserved');
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%'",
      );
      expect(new Set(tables.rows.map(row => String(row.name)))).toEqual(new Set(KNOWLEDGE_TABLE_NAMES));
      expect(
        (await client.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`)).rows[0]?.epoch,
      ).toBe(0);
    } finally {
      client.close();
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
            parentAddresses: ['org:acme', 'org:partner'],
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
      expect((await client.execute(`SELECT * FROM mastra_knowledge_node_scopes`)).rows).toHaveLength(2);
      expect((await client.execute(`SELECT * FROM mastra_knowledge_scope_grants`)).rows).toHaveLength(2);

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
        epoch: 1,
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
