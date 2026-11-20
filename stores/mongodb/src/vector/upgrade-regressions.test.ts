import { createVectorErrorId } from '@mastra/core/storage';
import type { Db, Document, MongoClient } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  REGISTRY,
  createRawSearchIndex,
  rawClient,
  listedId,
  seedCollection,
  uniqueName,
  waitFor,
  dropCollectionWithSearchIndexes,
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

const title = { metadata: { type: 'document', fields: { title: [{ type: 'string' }] } } };

describe('upgrade regressions: foreign full-text index reuse', () => {
  let client: MongoClient;
  let db: Db;
  let store: MongoDBVector;
  const created: string[] = [];

  beforeAll(async () => {
    client = await rawClient();
    db = client.db(DB_NAME);
    store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'upgrade-regressions' });
    await store.connect();
  });

  afterEach(async () => {
    for (const n of created.splice(0)) {
      await db.collection(REGISTRY).deleteOne({ _id: n as any });
      await dropCollectionWithSearchIndexes(db, n).catch(() => {});
    }
  });

  afterAll(async () => {
    await store.disconnect();
    await client.close();
  });

  /** BYO collection registered with createIndex, plus a foreign `docs_fts` full-text index. */
  async function setup(seededDefinition: Document) {
    const coll = uniqueName('upg');
    const indexName = `${coll}_idx`;
    created.push(coll, indexName);
    await seedCollection(db, coll, [{ metadata: { title: 'a', author: 'b' }, embedding: [1, 0, 0, 0] }]);
    await store.createIndex({ indexName, dimension: 4, collectionName: coll });
    await createRawSearchIndex(db, coll, 'docs_fts', seededDefinition, 'search');
    await waitFor(async () => (await db.collection(coll).listSearchIndexes('docs_fts').toArray()).length > 0);
    const [stored] = await db.collection(coll).listSearchIndexes('docs_fts').toArray();
    return { coll, indexName, stored: stored!.latestDefinition as Document };
  }

  async function expectConflict(coll: string, indexName: string, fields: string[], stored: Document) {
    const err = await store.createSearchIndex({ indexName, fields, searchIndexName: 'docs_fts' }).catch(e => e);
    expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
    const [idx] = await db.collection(coll).listSearchIndexes('docs_fts').toArray();
    expect(idx!.latestDefinition).toEqual(stored);
  }

  it('T1: a foreign index mapping different fields is a CONFLICT and is left unchanged', async () => {
    const seeded = { mappings: { dynamic: false, fields: title } };
    const { coll, indexName, stored } = await setup(seeded);
    await expectConflict(coll, indexName, ['metadata.author'], stored);
  });

  it('T2: same field names but a field-level analyzer is a CONFLICT', async () => {
    const seeded = {
      mappings: {
        dynamic: false,
        fields: {
          metadata: { type: 'document', fields: { author: [{ type: 'string', analyzer: 'lucene.english' }] } },
        },
      },
    };
    const { coll, indexName, stored } = await setup(seeded);
    await expectConflict(coll, indexName, ['metadata.author'], stored);
  });

  it('T3: identical mappings but a root analyzer is a CONFLICT', async () => {
    const seeded = {
      analyzer: 'lucene.english',
      mappings: {
        dynamic: false,
        fields: { metadata: { type: 'document', fields: { author: [{ type: 'string' }] } } },
      },
    };
    const { coll, indexName, stored } = await setup(seeded);
    await expectConflict(coll, indexName, ['metadata.author'], stored);
  });
});

describe('upgrade regressions: renamed full-text index cleanup', () => {
  it('T4: a renamed text index is not orphaned by deleteIndex', async () => {
    const client = await rawClient();
    const db = client.db(DB_NAME);
    const store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'upgrade-rename' });
    const coll = uniqueName('upgren');
    const indexName = `${coll}_idx`;
    try {
      try {
        await store.connect();
        await seedCollection(db, coll, [{ metadata: { title: 'a' }, embedding: [1, 0, 0, 0] }]);
        await store.createIndex({ indexName, dimension: 4, collectionName: coll });
        await store.createSearchIndex({ indexName, searchIndexName: 'a_fts' });
        await store.createSearchIndex({ indexName, searchIndexName: 'b_fts' });
        const ids = [await listedId(db, coll, 'a_fts'), await listedId(db, coll, 'b_fts')];
        expect(ids.every(Boolean)).toBe(true);
        await store.deleteIndex({ indexName });
        // A drop is asynchronous on a cluster: wait for both ids to go.
        const rowIds = async () => (await db.collection(coll).listSearchIndexes().toArray()).map(r => r.id);
        await waitFor(async () => !(await rowIds()).some(id => ids.includes(id)), 30_000);
      } finally {
        await db
          .collection(REGISTRY)
          .deleteOne({ _id: indexName as any })
          .catch(() => {});
        await dropCollectionWithSearchIndexes(db, coll).catch(() => {});
      }
    } finally {
      // Close both clients even if one close throws.
      await Promise.allSettled([store.disconnect(), client.close()]);
    }
  });
});

// PR #30067 review: `create` succeeds for an existing collection with identical options, so a
// collection another client created between createIndex's existence check and its create was
// recorded as Mastra's, and deleteIndex dropped it with the other client's data.
describe('upgrade regressions: managed collection created concurrently by another client', () => {
  it('T5: createIndex adopts it without ownership, and deleteIndex keeps it and its data', async () => {
    const client = await rawClient();
    const db = client.db(DB_NAME);
    const store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'upgrade-concurrent-coll' });
    const indexName = uniqueName('upgcon');
    try {
      try {
        await store.connect();
        const storeDb = (store as any).db;
        const create = storeDb.createCollection.bind(storeDb);
        // Another client creates the collection after Mastra found it missing, right before its create.
        vi.spyOn(storeDb, 'createCollection').mockImplementationOnce(async (...args: any[]) => {
          await db.collection(indexName).insertOne({ _id: 'theirs', note: 'not Mastra' } as any);
          return create(...args);
        });
        await store.createIndex({ indexName, dimension: 4 });
        expect(await db.collection(REGISTRY).findOne({ _id: indexName as any })).toMatchObject({
          ownsCollection: false,
        });
        await store.deleteIndex({ indexName });
        expect(await db.collection(indexName).countDocuments({ _id: 'theirs' as any })).toBe(1);
      } finally {
        await db
          .collection(REGISTRY)
          .deleteOne({ _id: indexName as any })
          .catch(() => {});
        await dropCollectionWithSearchIndexes(db, indexName).catch(() => {});
      }
    } finally {
      await Promise.allSettled([store.disconnect(), client.close()]);
    }
  }, 120_000);

  it('T5b: a collection createIndex creates itself is owned and dropped by deleteIndex', async () => {
    const client = await rawClient();
    const db = client.db(DB_NAME);
    const store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'upgrade-own-coll' });
    const indexName = uniqueName('upgown');
    try {
      try {
        await store.connect();
        await store.createIndex({ indexName, dimension: 4 });
        expect(await db.collection(REGISTRY).findOne({ _id: indexName as any })).toMatchObject({
          ownsCollection: true,
        });
        await store.deleteIndex({ indexName });
        expect(await db.listCollections({ name: indexName }).hasNext()).toBe(false);
      } finally {
        await db
          .collection(REGISTRY)
          .deleteOne({ _id: indexName as any })
          .catch(() => {});
        await dropCollectionWithSearchIndexes(db, indexName).catch(() => {});
      }
    } finally {
      await Promise.allSettled([store.disconnect(), client.close()]);
    }
  }, 120_000);
});
