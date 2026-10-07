import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { InMemoryStore, KnowledgeSchemaError, TABLE_KNOWLEDGE_SCHEMA } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../..';
import { withClientWriteLock } from '../../db/write-lock';
import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

describe('InMemory canonical parity', () => {
  createKnowledgeStorageTests(async () => (await new InMemoryStore().getStore('knowledge'))!);
});

const fixtures: { client: ReturnType<typeof createClient>; path: string }[] = [];
createKnowledgeStorageTests(() => {
  const path = join(tmpdir(), `mastra-knowledge-contract-${randomUUID()}.db`);
  const client = createClient({ url: `file:${path}` });
  fixtures.push({ client, path });
  return new KnowledgeLibSQL({ client });
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

describe('KnowledgeLibSQL semantic outbox claims', () => {
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
