import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
