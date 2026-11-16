import { Collection, MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoDBStore } from '../../index';
import type { MemoryStorageMongoDB } from './index';

const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const DB = 'mastra-update-thread-metadata-test';

const dropTestDb = async () => {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    await client.db(DB).dropDatabase();
  } finally {
    await client.close();
  }
};

describe('MemoryStorageMongoDB.updateThread metadata', () => {
  let store: MongoDBStore;
  let memory: MemoryStorageMongoDB;
  let otherProcess: MongoClient;

  beforeAll(async () => {
    await dropTestDb();
    store = new MongoDBStore({ id: 'update-thread-metadata', uri: URI, dbName: DB });
    await store.init();
    memory = (await store.getStore('memory')) as MemoryStorageMongoDB;
    otherProcess = new MongoClient(URI);
    await otherProcess.connect();
  });

  afterAll(async () => {
    await otherProcess.close();
    await store.close();
    await dropTestDb();
  });

  const seed = (id: string) =>
    memory.saveThread({
      thread: {
        id,
        resourceId: 'resource-1',
        title: 'Original title',
        metadata: { seeded: true },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

  it('keeps a metadata write that lands while a title-only update is in flight', async () => {
    await seed('thread-race');
    // Another process commits new metadata just before updateThread writes.
    const threads = otherProcess.db(DB).collection('mastra_threads');
    const concurrentWrite = () =>
      threads.updateOne({ id: 'thread-race' }, { $set: { metadata: { seeded: true, progress: 'observed' } } });
    let raced = false;
    for (const method of ['updateOne', 'findOneAndUpdate'] as const) {
      const original = Collection.prototype[method] as (...args: any[]) => any;
      vi.spyOn(Collection.prototype, method).mockImplementation(async function (this: Collection, ...args: any[]) {
        if (!raced && this.collectionName === 'mastra_threads') {
          raced = true;
          await concurrentWrite();
        }
        return original.apply(this, args);
      } as any);
    }

    const updated = await memory.updateThread({ id: 'thread-race', title: 'New title' });
    vi.restoreAllMocks();

    expect(raced).toBe(true);
    const stored = await memory.getThreadById({ threadId: 'thread-race' });
    expect(stored?.title).toBe('New title');
    expect(stored?.metadata).toEqual({ seeded: true, progress: 'observed' });
    expect(updated.title).toBe('New title');
    expect(updated.metadata).toEqual({ seeded: true, progress: 'observed' });
  });

  it('still merges metadata when it is passed', async () => {
    await seed('thread-merge');
    const updated = await memory.updateThread({ id: 'thread-merge', metadata: { added: 1 } });

    expect(updated.title).toBe('Original title');
    expect(updated.metadata).toEqual({ seeded: true, added: 1 });
    expect((await memory.getThreadById({ threadId: 'thread-merge' }))?.metadata).toEqual({ seeded: true, added: 1 });
  });

  it('throws not found for a title-only update of a missing thread', async () => {
    await expect(memory.updateThread({ id: 'missing', title: 'x' })).rejects.toThrow('Thread missing not found');
  });
});
