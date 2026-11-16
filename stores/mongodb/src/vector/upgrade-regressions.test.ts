import { createVectorErrorId } from '@mastra/core/storage';
import type { Db, Document, MongoClient } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  REGISTRY,
  createRawSearchIndex,
  rawClient,
  searchIndexNames,
  seedCollection,
  uniqueName,
  waitFor,
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
      await db.dropCollection(n).catch(() => {});
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
    await store.connect();
    const coll = uniqueName('upgren');
    const indexName = `${coll}_idx`;
    try {
      await seedCollection(db, coll, [{ metadata: { title: 'a' }, embedding: [1, 0, 0, 0] }]);
      await store.createIndex({ indexName, dimension: 4, collectionName: coll });
      await store.createSearchIndex({ indexName, searchIndexName: 'a_fts' });
      await store.createSearchIndex({ indexName, searchIndexName: 'b_fts' });
      await store.deleteIndex({ indexName });
      const names = await searchIndexNames(db, coll);
      expect(names).not.toContain('a_fts');
      expect(names).not.toContain('b_fts');
    } finally {
      await db.collection(REGISTRY).deleteOne({ _id: indexName as any });
      await db.dropCollection(coll).catch(() => {});
      await store.disconnect();
      await client.close();
    }
  });
});
