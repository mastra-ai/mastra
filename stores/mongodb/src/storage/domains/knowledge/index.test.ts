import { randomUUID } from 'node:crypto';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KnowledgeSchemaError,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  TABLE_KNOWLEDGE_SCHEMA,
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

describe('MongoDB canonical Knowledge support', () => {
  it('advertises the canonical contract and all managed collections', () => {
    expect(createStore().getCapabilities()).toEqual({
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    });
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS).toHaveLength(16);
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS.every(name => name.startsWith('mastra_knowledge_'))).toBe(true);
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

  it.each([false, true])(
    'converges when activation starts after the first collection with skipDefaultIndexes=%s',
    async skipDefaultIndexes => {
      const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
      const dbName = `knowledge-staggered-init-${randomUUID()}`;
      const first = resolveMongoDBConfig({ uri, dbName });
      const second = resolveMongoDBConfig({ uri, dbName });
      const client = new MongoClient(uri);
      let created!: () => void;
      const firstCollection = new Promise<void>(resolve => {
        created = resolve;
      });
      let release!: () => void;
      const resume = new Promise<void>(resolve => {
        release = resolve;
      });
      const create = first.createCollection.bind(first);
      vi.spyOn(first, 'createCollection').mockImplementationOnce(async (...args) => {
        const result = await create(...args);
        created();
        await resume;
        return result;
      });
      let observed!: () => void;
      const missingMarker = new Promise<void>(resolve => {
        observed = resolve;
      });
      const schema = await second.getCollection(TABLE_KNOWLEDGE_SCHEMA);
      const getCollection = second.getCollection.bind(second);
      vi.spyOn(second, 'getCollection').mockImplementation(name =>
        name === TABLE_KNOWLEDGE_SCHEMA ? Promise.resolve(schema) : getCollection(name),
      );
      const find = schema.findOne.bind(schema);
      vi.spyOn(schema, 'findOne').mockImplementationOnce(async (...args) => {
        const result = await find(...args);
        expect(result).toBeNull();
        observed();
        return result;
      });
      const firstRun = new KnowledgeMongoDB({ connector: first, skipDefaultIndexes }).init();
      await firstCollection;
      const secondRun = new KnowledgeMongoDB({ connector: second, skipDefaultIndexes }).init();
      const results = Promise.allSettled([firstRun, secondRun]);
      try {
        await missingMarker;
        release();
        expect(await results).toEqual([
          { status: 'fulfilled', value: undefined },
          { status: 'fulfilled', value: undefined },
        ]);
        expect((await second.listCollectionNames()).sort()).toEqual([...KnowledgeMongoDB.MANAGED_COLLECTIONS].sort());
        expect(await schema.countDocuments({ id: 'canonical' })).toBe(1);
      } finally {
        release();
        await results;
        await client.connect();
        await client.db(dbName).dropDatabase();
        await Promise.all([first.close(), second.close(), client.close()]);
      }
    },
  );

  it('rejects interrupted activation without modifying partial collections or unrelated data', async () => {
    const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0';
    const dbName = `knowledge-interrupted-init-${randomUUID()}`;
    const first = resolveMongoDBConfig({ uri, dbName });
    const restarted = resolveMongoDBConfig({ uri, dbName });
    const client = new MongoClient(uri);
    const create = first.createCollection.bind(first);
    vi.spyOn(first, 'createCollection').mockImplementationOnce(async (...args) => {
      await create(...args);
      throw new Error('activation interrupted');
    });
    try {
      await client.connect();
      const db = client.db(dbName);
      await db.collection('unrelated_sentinel').insertOne({ value: 'preserved' });
      await expect(new KnowledgeMongoDB({ connector: first }).init()).rejects.toThrow('activation interrupted');
      const names = (await restarted.listCollectionNames()).sort();
      const nodes = db.collection('mastra_knowledge_nodes');
      const indexes = await nodes.listIndexes().toArray();
      const restart = new KnowledgeMongoDB({ connector: restarted }).init();
      await expect(restart).rejects.toThrow(KnowledgeSchemaError);
      await expect(restart).rejects.toThrow(
        'If activation is still running, wait for it to finish before retrying. Reset the Knowledge domain explicitly before retrying.',
      );
      expect((await restarted.listCollectionNames()).sort()).toEqual(names);
      expect(await nodes.listIndexes().toArray()).toEqual(indexes);
      expect(await nodes.countDocuments()).toBe(0);
      expect(await db.collection('unrelated_sentinel').findOne({ value: 'preserved' })).not.toBeNull();
      expect(await db.collection(TABLE_KNOWLEDGE_SCHEMA).findOne({ id: 'canonical' })).toBeNull();
    } finally {
      await client.db(dbName).dropDatabase();
      await Promise.all([first.close(), restarted.close(), client.close()]);
    }
  });

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
});

afterAll(async () => {
  await connector.close();
});
