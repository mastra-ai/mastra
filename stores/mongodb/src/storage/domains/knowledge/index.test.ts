import { randomUUID } from 'node:crypto';
import { createKnowledgeSchemaLatchTests, createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  KnowledgeConflictError,
  KnowledgeSchemaError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_SCHEMA,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import { MongoClient } from 'mongodb';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { MongoDBStore } from '../..';
import { resolveMongoDBConfig } from '../../db';
import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connector = resolveMongoDBConfig({
  uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
});

function createStore() {
  return new KnowledgeMongoDB({ connector });
}

createKnowledgeStorageTests(createStore);

const latchDatabases: { name: string; connector: ReturnType<typeof resolveMongoDBConfig> }[] = [];
createKnowledgeSchemaLatchTests(async () => {
  const dbName = `knowledge-latch-${randomUUID()}`;
  const isolated = resolveMongoDBConfig({
    uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0',
    dbName,
  });
  latchDatabases.push({ name: dbName, connector: isolated });
  await (await isolated.getCollection(TABLE_KNOWLEDGE_NODES)).insertOne({ id: 'old', name: 'Old' });
  return {
    store: new KnowledgeMongoDB({ connector: isolated }),
    repair: async () => {
      await (await isolated.getCollection(TABLE_KNOWLEDGE_NODES)).drop();
    },
  };
});

describe('MongoDB canonical Knowledge support', () => {
  it('advertises the canonical contract and all managed collections', () => {
    expect(createStore().getCapabilities()).toEqual({
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    });
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS).toHaveLength(15);
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS.every(name => name.startsWith('mastra_knowledge_'))).toBe(true);
  });

  it('lists and claims scoped semantic work beyond a larger unrelated prefix', async () => {
    const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
    const dbName = `knowledge-outbox-${randomUUID()}`;
    const client = new MongoClient(uri);
    const isolated = new KnowledgeMongoDB({ connector: resolveMongoDBConfig({ uri, dbName }) });
    try {
      await client.connect();
      await isolated.init();
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const hiddenScopeId = '00000000-0000-4000-8000-000000000091';
      const visibleScopeId = '00000000-0000-4000-8000-000000000092';
      const entries = Array.from({ length: 1001 }, (_, index) => ({
        id: `hidden-${String(index).padStart(4, '0')}`,
        idempotencyKey: `hidden-${index}`,
        documentId: `knowledge:node:hidden-${index}`,
        documentType: 'node',
        operation: 'delete',
        scopeIds: [hiddenScopeId],
        status: 'pending',
        attempts: 0,
        availableAt: createdAt,
        createdAt,
      }));
      entries.push({
        id: 'visible-after-prefix',
        idempotencyKey: 'visible-after-prefix',
        documentId: 'knowledge:node:visible-after-prefix',
        documentType: 'node',
        operation: 'delete',
        scopeIds: [visibleScopeId],
        status: 'pending',
        attempts: 0,
        availableAt: createdAt,
        createdAt: new Date(createdAt.getTime() + 1),
      });
      await client.db(dbName).collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX).insertMany(entries);

      await expect(isolated.listSemanticOutbox({ scopeIds: [visibleScopeId], limit: 1 })).resolves.toEqual([
        expect.objectContaining({ id: 'visible-after-prefix' }),
      ]);
      await expect(
        isolated.claimSemanticOutbox({
          workerId: 'scoped-worker',
          scopeIds: [visibleScopeId],
          limit: 1,
          now: createdAt,
        }),
      ).resolves.toEqual([expect.objectContaining({ id: 'visible-after-prefix', claimedBy: 'scoped-worker' })]);
    } finally {
      await client.db(dbName).dropDatabase();
      await client.close();
    }
  });

  it('filters current owner visibility before limiting scoped semantic work', async () => {
    const store = createStore();
    await store.init();
    const suffix = randomUUID();
    const hiddenScopeId = randomUUID();
    const visibleScopeId = randomUUID();
    const hiddenNodeId = randomUUID();
    const visibleNodeId = randomUUID();
    const visibleRecordId = randomUUID();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const records = await connector.getCollection(TABLE_KNOWLEDGE_RECORDS);
    const recordScopes = await connector.getCollection(TABLE_KNOWLEDGE_RECORD_SCOPES);
    const outbox = await connector.getCollection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const nodeScopes = await connector.getCollection('mastra_knowledge_node_scopes');
    const hiddenRecords = Array.from({ length: 1001 }, (_, index) => ({
      id: randomUUID(),
      nodeId: hiddenNodeId,
      text: `hidden ${index}`,
      metadata: {},
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }));
    const recordIds = [...hiddenRecords.map(record => record.id), visibleRecordId];
    try {
      await store.createNode({ id: hiddenScopeId, name: `${suffix} hidden scope`, isScope: true, scopeIds: [] });
      await store.createNode({ id: visibleScopeId, name: `${suffix} visible scope`, isScope: true, scopeIds: [] });
      await store.createNode({ id: hiddenNodeId, name: `${suffix} hidden owner`, scopeIds: [hiddenScopeId] });
      await store.createNode({ id: visibleNodeId, name: `${suffix} visible owner`, scopeIds: [visibleScopeId] });
      await outbox.deleteMany({
        documentId: {
          $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId].map(id => `knowledge:node:${id}`),
        },
      });
      await records.insertMany([
        ...hiddenRecords,
        {
          id: visibleRecordId,
          nodeId: visibleNodeId,
          text: 'visible',
          metadata: {},
          version: 1,
          createdAt,
          updatedAt: createdAt,
        },
      ]);
      await recordScopes.insertMany(recordIds.map(recordId => ({ recordId, scopeNodeId: visibleScopeId })));
      await outbox.insertMany(
        recordIds.map((recordId, index) => ({
          id: `${suffix}-outbox-${String(index).padStart(4, '0')}`,
          idempotencyKey: `${suffix}-outbox-${recordId}`,
          documentId: `knowledge:record:${recordId}`,
          documentType: 'record',
          operation: 'upsert',
          scopeIds: [visibleScopeId],
          status: 'pending',
          attempts: 0,
          availableAt: createdAt,
          createdAt: new Date(createdAt.getTime() + index),
        })),
      );

      await expect(store.listSemanticOutbox({ scopeIds: [visibleScopeId], limit: 1 })).resolves.toEqual([
        expect.objectContaining({ documentId: `knowledge:record:${visibleRecordId}` }),
      ]);
      await expect(
        store.claimSemanticOutbox({
          workerId: 'owner-aware-worker',
          scopeIds: [visibleScopeId],
          limit: 1,
          now: new Date(createdAt.getTime() + 2000),
        }),
      ).resolves.toEqual([
        expect.objectContaining({ documentId: `knowledge:record:${visibleRecordId}`, claimedBy: 'owner-aware-worker' }),
      ]);
    } finally {
      await outbox.deleteMany({ id: { $regex: `^${suffix}` } });
      await recordScopes.deleteMany({ recordId: { $in: recordIds } });
      await records.deleteMany({ id: { $in: recordIds } });
      await nodeScopes.deleteMany({ nodeId: { $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId] } });
      await nodes.deleteMany({ id: { $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId] } });
    }
  });

  it('leaves incidental Knowledge collections untouched until explicit activation', async () => {
    const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
    const dbName = `knowledge-rollout-${randomUUID()}`;
    const client = new MongoClient(uri);
    const isolated = resolveMongoDBConfig({ uri, dbName });
    try {
      await client.connect();
      const db = client.db(dbName);
      const nodes = db.collection('mastra_knowledge_nodes');
      await nodes.createIndex({ type: 1, scopeKey: 1, canonicalName: 1 }, { unique: true });
      await db.collection('unrelated_sentinel').insertOne({ value: 'preserved' });
      const indexes = await nodes.listIndexes().toArray();
      const storage = new MongoDBStore({ id: 'rollout', uri, dbName });
      try {
        await storage.init();
      } finally {
        await storage.close();
      }
      expect(await nodes.listIndexes().toArray()).toEqual(indexes);
      expect(await db.listCollections({ name: TABLE_KNOWLEDGE_SCHEMA }).toArray()).toEqual([]);
      await expect(new KnowledgeMongoDB({ connector: isolated }).init()).rejects.toThrow(KnowledgeSchemaError);
      expect(await nodes.listIndexes().toArray()).toEqual(indexes);
      expect(await db.listCollections({ name: TABLE_KNOWLEDGE_SCHEMA }).toArray()).toEqual([]);
      expect(await db.collection('unrelated_sentinel').findOne({ value: 'preserved' })).not.toBeNull();
    } finally {
      await client.db(dbName).dropDatabase();
      await isolated.close();
      await client.close();
    }
  });

  it.each([false, true])('restarts with default indexes disabled and custom indexes=%s', async customIndexes => {
    const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
    const dbName = `knowledge-no-indexes-${randomUUID()}`;
    const isolated = resolveMongoDBConfig({ uri, dbName });
    const restarted = resolveMongoDBConfig({ uri, dbName });
    const client = new MongoClient(uri);
    const options = {
      skipDefaultIndexes: true,
      ...(customIndexes ? { indexes: [{ collection: 'mastra_knowledge_nodes', keys: { id: 1 as const } }] } : {}),
    };
    try {
      await new KnowledgeMongoDB({ connector: isolated, ...options }).init();
      expect((await isolated.listCollectionNames()).sort()).toEqual([...KnowledgeMongoDB.MANAGED_COLLECTIONS].sort());
      await isolated.close();
      await expect(new KnowledgeMongoDB({ connector: restarted, ...options }).init()).resolves.toBeUndefined();
      const nodes = await restarted.getCollection('mastra_knowledge_nodes');
      expect(Object.keys(await nodes.indexInformation()).sort()).toEqual(customIndexes ? ['_id_', 'id_1'] : ['_id_']);
    } finally {
      await client.connect();
      await client.db(dbName).dropDatabase();
      await Promise.all([isolated.close(), restarted.close(), client.close()]);
    }
  });

  it.each([false, true])(
    'converges under concurrent fresh activation with skipDefaultIndexes=%s',
    async skipDefaultIndexes => {
      const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
      const dbName = `knowledge-concurrent-init-${randomUUID()}`;
      const connectors = [resolveMongoDBConfig({ uri, dbName }), resolveMongoDBConfig({ uri, dbName })];
      const client = new MongoClient(uri);
      let arrived = 0;
      let release!: () => void;
      const ready = new Promise<void>(resolve => {
        release = resolve;
      });
      try {
        for (const current of connectors) {
          const list = current.listCollectionNames.bind(current);
          vi.spyOn(current, 'listCollectionNames').mockImplementationOnce(async () => {
            const names = await list();
            if (++arrived === connectors.length) release();
            await ready;
            return names;
          });
        }
        const results = await Promise.allSettled(
          connectors.map(connector => new KnowledgeMongoDB({ connector, skipDefaultIndexes }).init()),
        );
        expect(results).toEqual([
          { status: 'fulfilled', value: undefined },
          { status: 'fulfilled', value: undefined },
        ]);
        expect((await connectors[0]!.listCollectionNames()).sort()).toEqual(
          [...KnowledgeMongoDB.MANAGED_COLLECTIONS].sort(),
        );
        const schema = await connectors[0]!.getCollection(TABLE_KNOWLEDGE_SCHEMA);
        expect(await schema.countDocuments({ id: 'canonical', version: KNOWLEDGE_STORAGE_SCHEMA_VERSION })).toBe(1);
      } finally {
        await client.connect();
        await client.db(dbName).dropDatabase();
        await Promise.all([...connectors.map(connector => connector.close()), client.close()]);
      }
    },
  );

  it('persists the schema completion marker', async () => {
    const store = createStore();
    await store.init();
    const schema = await connector.getCollection(TABLE_KNOWLEDGE_SCHEMA);
    expect((await schema.findOne({ id: 'canonical' }))?.version).toBe(KNOWLEDGE_STORAGE_SCHEMA_VERSION);
  });

  it('creates required uniqueness and claim indexes idempotently', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const outbox = await connector.getCollection('mastra_knowledge_semantic_outbox');
    expect(Object.keys(await nodes.indexInformation())).toContain('activeNameScopeKey_1');
    expect(Object.keys(await outbox.indexInformation())).toContain('idempotencyKey_1');
  });

  it('commits concurrent fenced mutations at one epoch through write-conflict retries', async () => {
    const store = createStore();
    await store.init();
    const scope = await store.createNode({ name: `Busy scope ${randomUUID()}`, isScope: true, scopeIds: [] });
    const nodes = await Promise.all(
      Array.from({ length: 6 }, () => store.createNode({ name: `Busy ${randomUUID()}`, scopeIds: [scope.id] })),
    );
    const epoch = await store.getAccessEpoch();
    const updated = await Promise.all(
      nodes.map(node =>
        store.updateNode({
          id: node.id,
          version: node.version,
          name: `${node.name} renamed`,
          expectedAccessEpoch: epoch,
        }),
      ),
    );
    expect(updated.map(node => node.name)).toEqual(nodes.map(node => `${node.name} renamed`));
    expect(await store.getAccessEpoch()).toBe(epoch);
  });

  it('rejects a fenced mutation when a grant change commits while it waits on the access epoch', async () => {
    const store = createStore();
    await store.init();
    const scope = await store.createNode({ name: `Fence scope ${randomUUID()}`, isScope: true, scopeIds: [] });
    const node = await store.createNode({ name: `Fenced ${randomUUID()}`, scopeIds: [scope.id] });
    const epoch = await store.getAccessEpoch();
    const client = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0');
    const session = client.startSession();
    try {
      session.startTransaction();
      await client
        .db(process.env.MONGODB_DB_NAME || 'mastra-test-db')
        .collection(TABLE_KNOWLEDGE_ACCESS_STATE)
        .updateOne({ id: 'global' }, { $inc: { epoch: 1 } }, { session });
      const mutation = store.updateNode({
        id: node.id,
        version: node.version,
        name: 'Renamed',
        expectedAccessEpoch: epoch,
      });
      const settled = mutation.then(
        () => 'committed',
        () => 'rejected',
      );
      await new Promise(resolve => setTimeout(resolve, 300));
      await session.commitTransaction();
      await settled;
      await expect(mutation).rejects.toBeInstanceOf(KnowledgeConflictError);
    } finally {
      await session.endSession();
      await client.close();
    }
    expect((await store.getNode(node.id))?.name).toBe(node.name);
  });

  it('explicitly resets retired Knowledge collections and leaves other storage untouched', async () => {
    const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
    const dbName = `knowledge-reset-${randomUUID()}`;
    const isolated = resolveMongoDBConfig({ uri, dbName });
    const client = new MongoClient(uri);
    try {
      await (await isolated.getCollection('mastra_knowledge_cursors')).insertOne({ id: 'retired' });
      await (await isolated.getCollection(TABLE_KNOWLEDGE_NODES)).insertOne({ id: 'v1-node' });
      await (await isolated.getCollection('mastra_threads')).insertOne({ id: 'kept' });
      const store = new KnowledgeMongoDB({ connector: isolated });
      await expect(store.init()).rejects.toBeInstanceOf(KnowledgeSchemaError);

      await store.dangerouslyReset();

      const db = client.db(dbName);
      const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(collection => collection.name);
      expect(names).not.toContain('mastra_knowledge_cursors');
      expect(await (await isolated.getCollection(TABLE_KNOWLEDGE_NODES)).countDocuments()).toBe(0);
      expect(await (await isolated.getCollection(TABLE_KNOWLEDGE_SCHEMA)).findOne({ id: 'canonical' })).toMatchObject({
        version: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      });
      expect(await (await isolated.getCollection('mastra_threads')).countDocuments({ id: 'kept' })).toBe(1);
    } finally {
      await client.db(dbName).dropDatabase();
      await client.close();
      await isolated.close();
    }
  });
});

describe('KnowledgeMongoDB published v1 layout', () => {
  const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
  // Index sets captured from published @mastra/mongodb v1 and from builds of main (ecdc523f008).
  const mainIndexes: Record<string, [Record<string, 1 | -1>, boolean?][]> = {
    mastra_knowledge_activity: [[{ id: -1 }], [{ scopeKey: 1, id: -1 }]],
    mastra_knowledge_mentions: [
      [{ sourceType: 1, sourceId: 1, recordId: 1 }, true],
      [{ recordId: 1, sourceType: 1, sourceId: 1 }],
    ],
    mastra_knowledge_nodes: [
      [{ type: 1, scopeKey: 1, canonicalName: 1 }, true],
      [{ scopeKey: 1, type: 1 }],
      [{ type: 1, canonicalName: 1 }],
    ],
    mastra_knowledge_records: [[{ node: 1, id: -1 }], [{ sourceThreadId: 1, id: -1 }], [{ scopeKey: 1, id: -1 }]],
    mastra_knowledge_semantic_outbox: [[{ idempotencyKey: 1 }, true], [{ status: 1, availableAt: 1, createdAt: 1 }]],
  };
  const publishedIndexes: typeof mainIndexes = {
    ...Object.fromEntries(
      Object.entries(mainIndexes).map(([name, indexes]) => [
        name,
        indexes.filter(
          ([key]) =>
            !(
              JSON.stringify(key) === '{"scopeKey":1,"id":-1}' || JSON.stringify(key) === '{"type":1,"canonicalName":1}'
            ),
        ),
      ]),
    ),
    mastra_knowledge_cursors: [[{ sourceThreadId: 1, agent: 1 }, true]],
  };

  async function withV1Database(
    indexes: typeof mainIndexes,
    run: (context: {
      client: MongoClient;
      dbName: string;
      isolated: ReturnType<typeof resolveMongoDBConfig>;
    }) => Promise<void>,
  ): Promise<void> {
    const dbName = `knowledge-v1-${randomUUID()}`;
    const isolated = resolveMongoDBConfig({ uri, dbName });
    const client = new MongoClient(uri);
    try {
      const db = client.db(dbName);
      for (const [name, specs] of Object.entries(indexes)) {
        await db.createCollection(name);
        for (const [key, unique] of specs) await db.collection(name).createIndex(key, unique ? { unique } : {});
      }
      await db
        .collection(TABLE_KNOWLEDGE_NODES)
        .insertOne({ id: 'legacy', type: 'node', scopeKey: 'legacy', canonicalName: 'legacy' });
      await db.collection('mastra_threads').insertOne({ id: 'kept' });
      await run({ client, dbName, isolated });
    } finally {
      await client.db(dbName).dropDatabase();
      await client.close();
      await isolated.close();
    }
  }

  async function layout(client: MongoClient, dbName: string): Promise<string[]> {
    const db = client.db(dbName);
    const objects: string[] = [];
    for (const info of await db.listCollections().toArray()) {
      objects.push(`${info.type}:${info.name}`);
      if (info.type === 'collection') {
        for (const index of await db.collection(info.name).indexes())
          objects.push(`${info.name}#${JSON.stringify(index.key)}`);
      }
    }
    return objects.sort();
  }

  async function expectUntouched(
    client: MongoClient,
    dbName: string,
    isolated: ReturnType<typeof resolveMongoDBConfig>,
  ) {
    const before = await layout(client, dbName);
    await expect(new KnowledgeMongoDB({ connector: isolated }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
    expect(await layout(client, dbName)).toEqual(before);
    expect(await client.db(dbName).collection(TABLE_KNOWLEDGE_NODES).countDocuments({ id: 'legacy' })).toBe(1);
  }

  it.each([
    ['the layout releases built from main created', mainIndexes],
    ['the published v1 layout', publishedIndexes],
  ])('replaces %s, discarding its documents and keeping other storage', async (_name, indexes) => {
    await withV1Database(indexes, async ({ client, dbName, isolated }) => {
      await new KnowledgeMongoDB({ connector: isolated }).init();
      await new KnowledgeMongoDB({ connector: isolated }).init();

      const db = client.db(dbName);
      expect(await db.collection(TABLE_KNOWLEDGE_SCHEMA).findOne({ id: 'canonical' })).toMatchObject({
        version: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      });
      expect(await db.collection(TABLE_KNOWLEDGE_NODES).countDocuments()).toBe(0);
      const objects = await layout(client, dbName);
      expect(objects).not.toContain('collection:mastra_knowledge_cursors');
      expect(objects).not.toContain('mastra_knowledge_nodes#{"type":1,"scopeKey":1,"canonicalName":1}');
      expect(await db.collection('mastra_threads').countDocuments({ id: 'kept' })).toBe(1);
    });
  });

  it('finishes a replacement interrupted after dropping some v1 collections', async () => {
    const { mastra_knowledge_records, mastra_knowledge_semantic_outbox } = mainIndexes;
    await withV1Database(
      { mastra_knowledge_records, mastra_knowledge_semantic_outbox },
      async ({ client, dbName, isolated }) => {
        await new KnowledgeMongoDB({ connector: isolated }).init();
        expect(await client.db(dbName).collection(TABLE_KNOWLEDGE_SCHEMA).countDocuments({ id: 'canonical' })).toBe(1);
      },
    );
  });

  it('leaves a v1 layout with an unfamiliar index untouched', async () => {
    await withV1Database(mainIndexes, async ({ client, dbName, isolated }) => {
      await client.db(dbName).collection(TABLE_KNOWLEDGE_NODES).createIndex({ version: 1 });
      await expectUntouched(client, dbName, isolated);
    });
  });

  it('leaves a v1 layout beside a canonical collection untouched', async () => {
    await withV1Database(mainIndexes, async ({ client, dbName, isolated }) => {
      await client.db(dbName).collection(TABLE_KNOWLEDGE_RECORD_SCOPES).insertOne({ recordId: 'r', scopeNodeId: 's' });
      await expectUntouched(client, dbName, isolated);
    });
  });

  it('leaves a v1 layout that a view depends on untouched', async () => {
    await withV1Database(mainIndexes, async ({ client, dbName, isolated }) => {
      await client.db(dbName).createCollection('host_report', { viewOn: TABLE_KNOWLEDGE_NODES, pipeline: [] });
      await expectUntouched(client, dbName, isolated);
    });
  });
});

afterAll(async () => {
  const client = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0');
  try {
    for (const latch of latchDatabases) {
      await client.db(latch.name).dropDatabase();
      await latch.connector.close();
    }
  } finally {
    await client.close();
  }
  await connector.close();
});
