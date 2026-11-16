import { createVectorErrorId } from '@mastra/core/storage';
import type { Db, MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  createRawSearchIndex,
  rawClient,
  searchIndexNames,
  seedCollection,
  uniqueName,
  waitFor,
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

describe('legacy ownership', () => {
  let client: MongoClient;
  let db: Db;
  let store: MongoDBVector;

  beforeAll(async () => {
    client = await rawClient();
    db = client.db(DB_NAME);
    store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'legacy-ownership' });
    await store.connect();
  });

  afterAll(async () => {
    await store.disconnect();
    await client.close();
  });

  it('T5a: deleteIndex on a pre-1.15 collection refuses with NOT_REGISTERED and drops nothing', async () => {
    const X = uniqueName('legacy');
    await seedCollection(db, X);
    await createRawSearchIndex(db, X, `${X}_vector_index`, {
      fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
    });
    await waitFor(async () => (await searchIndexNames(db, X)).includes(`${X}_vector_index`));

    const err = await store.deleteIndex({ indexName: X }).catch(e => e);
    expect(err.id).toBe(createVectorErrorId('MONGODB', 'DELETE_INDEX', 'NOT_REGISTERED'));
    expect(err.category).toBe('USER');
    expect(err.message).toMatch(/claimLegacyIndex\(\{ indexName/);
    expect(await db.listCollections({ name: X }).hasNext()).toBe(true);
    expect(await searchIndexNames(db, X)).toContain(`${X}_vector_index`);

    await db.dropCollection(X);
  });
});
