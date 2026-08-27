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
import { KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

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

  it('persists normalized multi-scope node membership and record scope rules', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      const store = new KnowledgeLibSQL({ client });
      await store.init();
      const now = new Date().toISOString();
      for (const [id, name, isScope] of [
        ['scope-a', 'Scope A', 1],
        ['scope-b', 'Scope B', 1],
        ['node-a', 'Node A', 0],
      ] as const) {
        await client.execute({
          sql: `INSERT INTO mastra_knowledge_nodes (id,name,isScope,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
          args: [id, name, isScope, 1, now, now],
        });
      }
      await client.batch(
        [
          {
            sql: `INSERT INTO mastra_knowledge_node_scopes (nodeId,scopeNodeId,addedAt) VALUES (?,?,?)`,
            args: ['node-a', 'scope-a', now],
          },
          {
            sql: `INSERT INTO mastra_knowledge_node_scopes (nodeId,scopeNodeId,addedAt) VALUES (?,?,?)`,
            args: ['node-a', 'scope-b', now],
          },
          {
            sql: `INSERT INTO mastra_knowledge_records (id,nodeId,text,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
            args: ['record-a', 'node-a', 'scoped', 1, now, now],
          },
          {
            sql: `INSERT INTO mastra_knowledge_record_scopes (recordId,scopeNodeId,addedAt) VALUES (?,?,?)`,
            args: ['record-a', 'scope-b', now],
          },
        ],
        'write',
      );

      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_node_scopes WHERE nodeId='node-a'`)).rows,
      ).toHaveLength(2);
      expect(
        (await client.execute(`SELECT scopeNodeId FROM mastra_knowledge_record_scopes WHERE recordId='record-a'`))
          .rows[0]?.scopeNodeId,
      ).toBe('scope-b');
      expect(store.getCapabilities()).toMatchObject({ schemaVersion: 2, supportsV2: true });
    } finally {
      client.close();
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
