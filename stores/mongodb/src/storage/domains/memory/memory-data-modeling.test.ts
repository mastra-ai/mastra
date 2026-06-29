import { MastraError } from '@mastra/core/error';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { MongoDBStore } from '../../index';
import { MemoryStorageMongoDB } from './index';

const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB = 'mastra-memory-data-modeling-test'; // dedicated, fresh db so "absence of dropped index" assertions are valid

const dropTestDb = async () => {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    await client.db(DB).dropDatabase();
  } finally {
    await client.close();
  }
};

describe('MemoryStorageMongoDB — index definitions and metadata storage', () => {
  beforeAll(dropTestDb);
  afterAll(dropTestDb);

  test('memory collections have the expected index set after init', async () => {
    const store = new MongoDBStore({ id: 'memory-data-modeling-a1', uri: URI, dbName: DB });
    await store.init();

    const client = new MongoClient(URI);
    try {
      await client.connect();
      const db = client.db(DB);
      const keysFor = async (coll: string) =>
        (await db.collection(coll).indexes())
          .map(i => JSON.stringify(i.key))
          .filter(k => k !== JSON.stringify({ _id: 1 }));

      // Threads: id + two resource-scoped compounds; standalone resourceId/createdAt/updatedAt dropped.
      const threads = await keysFor('mastra_threads');
      expect(threads).toContain(JSON.stringify({ resourceId: 1, createdAt: -1 }));
      expect(threads).toContain(JSON.stringify({ resourceId: 1, updatedAt: -1 }));
      expect(threads).not.toContain(JSON.stringify({ resourceId: 1 }));
      expect(threads).not.toContain(JSON.stringify({ createdAt: -1 }));
      expect(threads).not.toContain(JSON.stringify({ updatedAt: -1 }));

      // Messages: id + per-thread and per-resource compounds; standalone thread_id/createdAt dropped.
      const messages = await keysFor('mastra_messages');
      expect(messages).toContain(JSON.stringify({ thread_id: 1, createdAt: 1 }));
      expect(messages).toContain(JSON.stringify({ resourceId: 1, createdAt: 1 }));
      expect(messages).not.toContain(JSON.stringify({ thread_id: 1 }));
      expect(messages).not.toContain(JSON.stringify({ createdAt: -1 }));

      // Resources: only id.
      const resources = await keysFor('mastra_resources');
      expect(resources).toEqual([JSON.stringify({ id: 1 })]);

      // OM: id + lookupKey/generationCount compound; standalone lookupKey dropped.
      const om = await keysFor('mastra_observational_memory');
      expect(om).toContain(JSON.stringify({ lookupKey: 1, generationCount: -1 }));
      expect(om).not.toContain(JSON.stringify({ lookupKey: 1 }));

      // The id indexes must remain unique.
      for (const coll of ['mastra_threads', 'mastra_messages', 'mastra_resources', 'mastra_observational_memory']) {
        const idx = (await db.collection(coll).indexes()).find(
          i => JSON.stringify(i.key) === JSON.stringify({ id: 1 }),
        );
        expect(idx?.unique).toBe(true);
      }
    } finally {
      await client.close();
      await store.close();
    }
  });

  test('resource metadata is stored as a native sub-document; legacy string rows still parse on read', async () => {
    const store = new MongoDBStore({ id: 'memory-data-modeling-a3', uri: URI, dbName: DB });
    await store.init();
    const memory = await store.getStore('memory');

    const resourceId = `res-a3-${Date.now()}`;
    await memory?.saveResource({
      resource: {
        id: resourceId,
        workingMemory: 'wm',
        metadata: { tier: 'gold', nested: { count: 3 } },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const client = new MongoClient(URI);
    try {
      await client.connect();
      const resources = client.db(DB).collection('mastra_resources');

      // saveResource stores metadata as a native sub-document, not a JSON string.
      const raw = await resources.findOne<any>({ id: resourceId });
      expect(typeof raw.metadata).toBe('object');
      expect(raw.metadata.tier).toBe('gold');

      // getResourceById returns an object.
      const fetched = await memory?.getResourceById({ resourceId });
      expect(fetched?.metadata).toEqual({ tier: 'gold', nested: { count: 3 } });

      // updateResource also writes metadata natively (merging with existing).
      await memory?.updateResource({ resourceId, metadata: { tier: 'platinum' } });
      const rawUpdated = await resources.findOne<any>({ id: resourceId });
      expect(typeof rawUpdated.metadata).toBe('object');
      expect(rawUpdated.metadata).toEqual({ tier: 'platinum', nested: { count: 3 } });

      // Back-compat: a legacy row whose metadata is a JSON string still parses on read.
      const legacyId = `res-a3-legacy-${Date.now()}`;
      await resources.insertOne({
        id: legacyId,
        workingMemory: '',
        metadata: JSON.stringify({ tier: 'silver' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const legacy = await memory?.getResourceById({ resourceId: legacyId });
      expect(legacy?.metadata).toEqual({ tier: 'silver' });
    } finally {
      await client.close();
      await store.close();
    }
  });

  test('createDefaultIndexes throws a MastraError when index creation fails', async () => {
    const throwingMemory = new MemoryStorageMongoDB({
      connectorHandler: {
        getCollection: async () =>
          ({
            createIndex: async () => {
              throw new Error('index build failed (simulated)');
            },
          }) as any,
        close: async () => {},
      },
    });

    const err = await throwingMemory.createDefaultIndexes().catch(e => e);
    expect(err).toBeInstanceOf(MastraError);
    expect(String(err.id)).toContain('CREATE_DEFAULT_INDEXES');
  });

  test('createDefaultIndexes resolves when index creation succeeds', async () => {
    const okMemory = new MemoryStorageMongoDB({
      connectorHandler: {
        getCollection: async () => ({ createIndex: async () => 'ok' }) as any,
        close: async () => {},
      },
    });

    await expect(okMemory.createDefaultIndexes()).resolves.toBeUndefined();
  });

  test.todo(
    'F3: concurrent swapBufferedToActive calls must not duplicate observation chunks ' +
      '(non-deterministic: requires two goroutine-equivalent async tasks to read the same snapshot)',
  );

  test.todo(
    'F4: concurrent updateBufferedReflection calls must not lose one write ' +
      '(non-deterministic: lost update requires two writes to race on the same document)',
  );
});
