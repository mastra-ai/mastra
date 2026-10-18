import { randomUUID } from 'node:crypto';
import type { MemoryStorage } from '@mastra/core/storage';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoDBStore } from '../../index';

const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = `om-history-search-${Date.now()}`;

describe('MongoDB observational memory group search', () => {
  let store: MongoDBStore;
  let memory: MemoryStorage;
  let client: MongoClient;

  beforeAll(async () => {
    store = new MongoDBStore({ id: 'om-history-search', uri, dbName });
    await store.init();
    memory = (await store.getStore('memory'))!;
    client = await MongoClient.connect(uri);
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
    await store.close().catch(() => {});
  });

  it('skips buffered chunks that are not stored as an array', async () => {
    const threadId = `thread-${randomUUID()}`;
    const record = await memory.initializeObservationalMemory({
      threadId,
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    await memory.updateActiveObservations({
      id: record.id,
      observations: '<observation-group id="active" range="a:b">kept</observation-group>',
      tokenCount: 1,
      lastObservedAt: new Date(),
    });
    await client
      .db(dbName)
      .collection('mastra_observational_memory')
      .updateOne({ id: record.id }, { $set: { bufferedObservationChunks: {} } });

    expect(await memory.getObservationalMemoryHistory(threadId, 'resource', 1, { groupId: 'missing' })).toEqual([]);
    expect(
      (await memory.getObservationalMemoryHistory(threadId, 'resource', 1, { groupId: 'active' })).map(r => r.id),
    ).toEqual([record.id]);
  });
});
