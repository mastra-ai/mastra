import { MastraError } from '@mastra/core/error';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryStorageMongoDB } from './domains/memory';
import { MongoDBStore } from './index';

const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB = 'mastra-hardening-test'; // dedicated, fresh db so "absence of dropped index" assertions are valid

const dropTestDb = async () => {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    await client.db(DB).dropDatabase();
  } finally {
    await client.close();
  }
};

describe('Hardening: NODE-7556 — data modeling (Tranche A)', () => {
  beforeAll(dropTestDb);
  afterAll(dropTestDb);

  it('A1: memory collections have exactly the audited index set after init', async () => {
    const store = new MongoDBStore({ id: 'hardening-a1', uri: URI, dbName: DB });
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
        const idx = (await db.collection(coll).indexes()).find(i => JSON.stringify(i.key) === JSON.stringify({ id: 1 }));
        expect(idx?.unique).toBe(true);
      }
    } finally {
      await client.close();
      await store.close();
    }
  });

  it('A3: resource metadata is stored as a native object and reads back as an object (and legacy strings still parse)', async () => {
    const store = new MongoDBStore({ id: 'hardening-a3', uri: URI, dbName: DB });
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

  it('A4: createDefaultIndexes throws a MastraError when an index cannot be created', async () => {
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

  it('A4: createDefaultIndexes resolves when index creation succeeds', async () => {
    const okMemory = new MemoryStorageMongoDB({
      connectorHandler: {
        getCollection: async () => ({ createIndex: async () => 'ok' }) as any,
        close: async () => {},
      },
    });

    await expect(okMemory.createDefaultIndexes()).resolves.toBeUndefined();
  });
});
