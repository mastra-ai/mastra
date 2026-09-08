import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { TABLE_KNOWLEDGE_RECORDS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { withClientWriteLock } from '../../db/write-lock';
import { KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

describe('KnowledgeLibSQL initialization', () => {
  it('adds the description column to pre-existing tables and reads legacy rows as undefined', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      // Pre-description table shape, created via raw DDL.
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
      await store.init();

      const columns = await client.execute(`PRAGMA table_info("mastra_knowledge_nodes")`);
      expect(columns.rows.map(row => String(row.name))).toContain('description');

      const legacy = await store.getNode('01LEGACY000000000000000000');
      expect(legacy?.description).toBeUndefined();
      expect(legacy?.content).toBe('legacy body');
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
      await first.init();
      await second.init();
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
