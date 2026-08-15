import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { TABLE_KNOWLEDGE_RECORDS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { withClientWriteLock } from '../../db/write-lock';
import { KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

describe('KnowledgeLibSQL initialization', () => {
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
        .advanceCurationCursor({ sourceThreadId: 'thread-1', agent: 'capture', lastItemId: 'item-1' })
        .then(() => {
          cursorAdvanced = true;
        });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cursorAdvanced).toBe(false);

      releaseLock();
      await Promise.all([lockedWrite, advance]);
      expect(await store.getCurationCursor({ sourceThreadId: 'thread-1', agent: 'capture' })).toEqual(
        expect.objectContaining({ lastItemId: 'item-1' }),
      );
    } finally {
      client.close();
    }
  });

  it('migrates legacy entities, pages, facts, and cursors without losing content', async () => {
    const client = createClient({
      url: `file:/tmp/mastra-legacy-knowledge-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
    });
    try {
      await client.batch([
        `CREATE TABLE mastra_knowledge_records (id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, canonicalName TEXT NOT NULL, kind TEXT, body TEXT, scope TEXT NOT NULL, scopeKey TEXT NOT NULL, version INTEGER NOT NULL, mergedInto TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
        `CREATE UNIQUE INDEX idx_knowledge_records_identity ON mastra_knowledge_records(type, scopeKey, canonicalName)`,
        `CREATE TABLE mastra_knowledge_facts (id TEXT PRIMARY KEY, parentEntityId TEXT NOT NULL, text TEXT NOT NULL, scope TEXT NOT NULL, scopeKey TEXT NOT NULL, sourceThreadId TEXT NOT NULL, capturedAt TEXT NOT NULL, "when" TEXT, maxScope TEXT, deletedAt TEXT, deletedBy TEXT)`,
        `CREATE TABLE mastra_knowledge_mentions (sourceType TEXT NOT NULL, sourceId TEXT NOT NULL, recordId TEXT NOT NULL, PRIMARY KEY(sourceType, sourceId, recordId))`,
        `CREATE TABLE mastra_knowledge_cursors (sourceThreadId TEXT NOT NULL, agent TEXT NOT NULL, lastFactId TEXT NOT NULL, updatedAt TEXT NOT NULL, PRIMARY KEY(sourceThreadId, agent))`,
        `INSERT INTO mastra_knowledge_records VALUES ('entity-1','entity','Deploy','deploy','task',NULL,'["org:acme"]','org:acme',1,NULL,'2026-01-01','2026-01-01')`,
        `INSERT INTO mastra_knowledge_records VALUES ('page-1','page','Deploy','deploy',NULL,'Release [[Deploy]]','["org:acme"]','org:acme',1,NULL,'2026-01-01','2026-01-01')`,
        `INSERT INTO mastra_knowledge_facts VALUES ('fact-1','entity-1','Ready','["org:acme"]','org:acme','thread-1','2026-01-01',NULL,NULL,NULL,NULL)`,
        `INSERT INTO mastra_knowledge_mentions VALUES ('page','page-1','entity-1')`,
        `INSERT INTO mastra_knowledge_cursors VALUES ('thread-1','capture','fact-1','2026-01-01')`,
      ]);

      const store = new KnowledgeLibSQL({ client });
      await store.init();

      expect(await store.getNode('entity-1')).toEqual(
        expect.objectContaining({ type: 'node', content: 'Release [[Deploy]]' }),
      );
      expect(await store.getNode('page-1')).toBeNull();
      expect(await store.getItem({ id: 'fact-1' })).toEqual(
        expect.objectContaining({ id: 'fact-1', parentNodeId: 'entity-1' }),
      );
      expect(await store.getCurationCursor({ sourceThreadId: 'thread-1', agent: 'capture' })).toEqual(
        expect.objectContaining({ lastItemId: 'fact-1' }),
      );
    } finally {
      client.close();
    }
  });

  it('is repeatable and adds knowledge tables to an existing store', async () => {
    const client = createClient({ url: 'file::memory:?cache=shared' });
    try {
      await client.execute('CREATE TABLE existing_domain (id TEXT PRIMARY KEY)');
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
