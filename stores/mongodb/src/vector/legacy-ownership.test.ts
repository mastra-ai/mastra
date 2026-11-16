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
  seedRegistry,
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

  describe('foreign full-text index reuse', () => {
    const titleDef = {
      mappings: { dynamic: false, fields: { metadata: { type: 'document', fields: { title: [{ type: 'string' }] } } } },
    };
    const created: string[] = [];

    afterEach(async () => {
      for (const n of created.splice(0)) {
        await db.collection(REGISTRY).deleteOne({ _id: n as any });
        await db.dropCollection(n).catch(() => {});
      }
    });

    async function setup(def: Document, wait: boolean) {
      const coll = uniqueName('own');
      const indexName = `${coll}_idx`;
      created.push(coll, indexName);
      await seedCollection(db, coll, [{ metadata: { title: 'a' }, embedding: [1, 0, 0, 0] }]);
      await store.createIndex({ indexName, dimension: 4, collectionName: coll });
      await createRawSearchIndex(db, coll, 'docs_fts', def, 'search');
      if (wait)
        await waitFor(async () => (await db.collection(coll).listSearchIndexes('docs_fts').toArray()).length > 0);
      const [stored] = await db.collection(coll).listSearchIndexes('docs_fts').toArray();
      return { coll, indexName, stored: stored?.latestDefinition as Document };
    }

    async function t12(coll: string, indexName: string) {
      await store.createSearchIndex({ indexName, fields: ['metadata.title'], searchIndexName: 'docs_fts' });
      const reg = await db.collection(REGISTRY).findOne({ _id: indexName as any });
      expect(reg?.ownsTextIndex).not.toBe(true);
      await store.deleteIndex({ indexName });
      expect(await searchIndexNames(db, coll)).toContain('docs_fts');
    }

    async function t1(coll: string, indexName: string, stored: Document) {
      const err = await store
        .createSearchIndex({ indexName, fields: ['metadata.author'], searchIndexName: 'docs_fts' })
        .catch(e => e);
      expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
      const [idx] = await db.collection(coll).listSearchIndexes('docs_fts').toArray();
      expect(idx!.latestDefinition).toEqual(stored);
    }

    async function statusOrSkip(ctx: { skip: (note?: string) => never }, coll: string) {
      const [idx] = await db.collection(coll).listSearchIndexes('docs_fts').toArray();
      if (!['PENDING', 'BUILDING'].includes(idx?.status)) ctx.skip('index became READY before the comparison');
    }

    it('T12: an equivalent foreign definition is reused, not owned, and survives deleteIndex', async () => {
      const { coll, indexName } = await setup(titleDef, true);
      await t12(coll, indexName);
    });

    it('RF1 (T1): comparison works while the foreign index is still PENDING/BUILDING', async ctx => {
      const { coll, indexName } = await setup(titleDef, false);
      await statusOrSkip(ctx, coll);
      await t1(
        coll,
        indexName,
        (await db.collection(coll).listSearchIndexes('docs_fts').toArray())[0]!.latestDefinition,
      );
    });

    it('RF1 (T12): equivalent reuse works while the foreign index is still PENDING/BUILDING', async ctx => {
      const { coll, indexName } = await setup(titleDef, false);
      await statusOrSkip(ctx, coll);
      await t12(coll, indexName);
    });

    it('T7a: a flagless managed entry gets a claimLegacyIndex hint and its index is untouched', async () => {
      const X = uniqueName('hint');
      created.push(X);
      await seedCollection(db, X, [{ title: 'a' }]);
      const dynamicDef = { mappings: { dynamic: true } };
      await createRawSearchIndex(db, X, `${X}_search_index`, dynamicDef, 'search');
      await waitFor(async () => (await searchIndexNames(db, X)).includes(`${X}_search_index`));
      const [before] = await db.collection(X).listSearchIndexes(`${X}_search_index`).toArray();
      await seedRegistry(db, {
        _id: X,
        indexName: X,
        collectionName: X,
        searchIndexName: `${X}_vector_index`,
        isByo: false,
        textSearchIndexName: `${X}_search_index`,
      });
      const err = await store
        .createSearchIndex({ indexName: X, fields: ['title'], searchIndexName: `${X}_search_index` })
        .catch(e => e);
      expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
      expect(err.message).toMatch(/claimLegacyIndex/);
      const [idx] = await db.collection(X).listSearchIndexes(`${X}_search_index`).toArray();
      expect(idx!.latestDefinition).toEqual(before!.latestDefinition);
    });
  });
});
