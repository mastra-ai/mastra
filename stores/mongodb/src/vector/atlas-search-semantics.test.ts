import type { Db, Document, MongoClient } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  REGISTRY,
  dropCollectionWithSearchIndexes,
  listedId,
  rawClient,
  searchIndexNames,
  seedCollection,
  uniqueName,
  waitFor,
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

/** Set by a cluster run: the fixture then connects to the Atlas cluster at this URI instead of Atlas Local. */
const NATIVE_CLUSTER = process.env.OWNERSHIP_TEST_URI !== undefined;

const definition = (numDimensions = 4) => ({
  fields: [{ type: 'vector', path: 'embedding', numDimensions, similarity: 'cosine' }],
});

/**
 * Design §0: the Atlas search-index semantics the ownership protocol relies on, pinned with the raw
 * driver on a throwaway collection per test. Atlas Local by default; the cluster when NATIVE_CLUSTER.
 */
describe('Atlas search-index semantics (§0)', () => {
  let client: MongoClient;
  let db: Db;
  const colls: string[] = [];

  beforeAll(async () => {
    client = await rawClient();
    db = client.db(DB_NAME);
  });

  afterEach(async () => {
    for (const c of colls.splice(0)) {
      await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
      // Tolerate only a collection a test never created (26); any other failure must surface.
      await dropCollectionWithSearchIndexes(db, c).catch((err: { code?: number }) => {
        if (err?.code !== 26) throw err;
      });
    }
  });

  afterAll(async () => {
    await client.close();
  });

  async function throwaway(prefix: string): Promise<string> {
    const coll = uniqueName(prefix);
    colls.push(coll);
    await seedCollection(db, coll, [{ embedding: [1, 0, 0, 0] }]);
    return coll;
  }

  const create = (coll: string, name: string, def: Document = definition()) =>
    db.command(
      { createSearchIndexes: coll, indexes: [{ name, type: 'vectorSearch', definition: def }] },
      { readPreference: 'primary' },
    );
  const createdId = (reply: Document) => reply.indexesCreated?.[0]?.id as string | undefined;
  const dropById = (coll: string, id: string) =>
    db.command({ dropSearchIndex: coll, id }, { readPreference: 'primary' });
  const listById = (coll: string, id: string) =>
    db
      .collection(coll)
      .aggregate([{ $listSearchIndexes: { id } }])
      .toArray();

  it('S0: a new index is listed at once with a 24-hex id, and $listSearchIndexes filters by id', async () => {
    const coll = await throwaway('s0list');
    const id = createdId(await create(coll, 'a'));
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(await listedId(db, coll, 'a')).toBe(id);
    const other = createdId(await create(coll, 'b'));
    expect(other).not.toBe(id);
    expect((await listById(coll, id!)).map(r => [r.name, r.id])).toEqual([['a', id]]);
  });

  it('S0: drop then recreate gives a new id, and a drop by the stale id fails with 27 and keeps the new index', async () => {
    const coll = await throwaway('s0recreate');
    const stale = createdId(await create(coll, 'n'))!;
    await dropById(coll, stale);
    // A dropped row can stay listed for a while on a cluster; R12 treats a dying row as "retry",
    // so wait for it to go before recreating the name.
    await waitFor(async () => (await listedId(db, coll, 'n')) === undefined);
    const fresh = createdId(await create(coll, 'n'));
    expect(fresh).toMatch(/^[0-9a-f]{24}$/);
    expect(fresh).not.toBe(stale);
    await expect(dropById(coll, stale)).rejects.toMatchObject({ code: 27 });
    expect(await listedId(db, coll, 'n')).toBe(fresh);
  });

  it('S0: dropSearchIndex with name and id together fails with 72', async () => {
    const coll = await throwaway('s0nameid');
    const id = createdId(await create(coll, 'n'))!;
    await expect(
      db.command({ dropSearchIndex: coll, name: 'n', id }, { readPreference: 'primary' }),
    ).rejects.toMatchObject({ code: 72 });
    expect(await listedId(db, coll, 'n')).toBe(id);
  });

  it('S0: an identical create succeeds; on the cluster its id equals the existing id, on Atlas Local it matches no index', async () => {
    const coll = await throwaway('s0identical');
    const existing = createdId(await create(coll, 'n'))!;
    const answered = createdId(await create(coll, 'n'));
    expect(answered).toMatch(/^[0-9a-f]{24}$/);
    if (NATIVE_CLUSTER) {
      expect(answered).toBe(existing);
    } else {
      expect(answered).not.toBe(existing);
      expect(await listById(coll, answered!)).toEqual([]);
    }
    expect(await listedId(db, coll, 'n')).toBe(existing);
  });

  it('S0: a different-definition create fails with IndexAlreadyExists', async () => {
    const coll = await throwaway('s0different');
    const id = createdId(await create(coll, 'n'))!;
    await expect(create(coll, 'n', definition(8))).rejects.toMatchObject({ codeName: 'IndexAlreadyExists' });
    expect(await listedId(db, coll, 'n')).toBe(id);
  });

  // §0's 26 is from a drop or a create: Atlas Local 8.2.11 lists a missing collection as empty.
  // The store reads 26 from a listing as no rows, so both answers mean absent.
  it('S0: a missing collection fails a drop by id and a create with 26, and lists no index', async () => {
    const missing = uniqueName('s0missing');
    colls.push(missing); // if a create unexpectedly succeeds natively, afterEach still removes the collection
    await expect(dropById(missing, '000000000000000000000000')).rejects.toMatchObject({ code: 26 });
    await expect(create(missing, 'n')).rejects.toMatchObject({ code: 26 });
    const listing = await db
      .collection(missing)
      .listSearchIndexes()
      .toArray()
      .catch((err: { code?: number }) => err);
    // shortcut: the cluster's listing of a missing collection was not probed; [] or 26 both mean absent.
    if (NATIVE_CLUSTER && !Array.isArray(listing)) expect(listing).toMatchObject({ code: 26 });
    else expect(listing).toEqual([]);
    expect(await db.listCollections({ name: missing }).toArray()).toEqual([]);
  });

  // Probed on Atlas Local only (§0: "not probed" on the cluster, assumed the same).
  it.skipIf(NATIVE_CLUSTER)('S0: search-index commands reject writeConcern', async () => {
    const coll = await throwaway('s0wc');
    const writeConcern = { w: 'majority' };
    const unsupported = { message: expect.stringMatching(/does not support writeConcern/i) };
    await expect(
      db.command(
        {
          createSearchIndexes: coll,
          indexes: [{ name: 'n', type: 'vectorSearch', definition: definition() }],
          writeConcern,
        },
        { readPreference: 'primary' },
      ),
    ).rejects.toMatchObject(unsupported);
    const id = createdId(await create(coll, 'n'))!;
    await expect(
      db.command(
        { updateSearchIndex: coll, id, definition: definition(8), writeConcern },
        { readPreference: 'primary' },
      ),
    ).rejects.toMatchObject(unsupported);
    await expect(
      db.command({ dropSearchIndex: coll, id, writeConcern }, { readPreference: 'primary' }),
    ).rejects.toMatchObject(unsupported);
    expect(await listedId(db, coll, 'n')).toBe(id);
  });

  // §7 timing supplement: the cluster's real latencies. Supplementary only.
  it.runIf(NATIVE_CLUSTER)(
    'timing supplement: 20 parallel identical createIndex calls, then delete and recreate',
    async () => {
      const coll = await throwaway('s0timing');
      const vec = `${coll}_vector_index`;
      const store = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 's0-timing' });
      await store.connect();
      const entry = () => db.collection(REGISTRY).findOne({ _id: coll as any });
      const createByo = () => store.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
      try {
        await Promise.all(Array.from({ length: 20 }, createByo));
        const docs = await db
          .collection(REGISTRY)
          .find({ _id: coll as any })
          .toArray();
        expect(docs).toHaveLength(1);
        expect(typeof docs[0]?.generation).toBe('string');
        expect(docs[0]?.ownsVectorIndex).toBe(true);
        const first = await listedId(db, coll, vec);
        expect(docs[0]?.indexIds).toEqual([{ name: vec, id: first }]);

        await store.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);

        await createByo();
        const recreated = await listedId(db, coll, vec);
        expect(recreated).toBeDefined();
        expect(recreated).not.toBe(first);
        const e = await entry();
        expect(e?.ownsVectorIndex).toBe(true);
        expect(e?.indexIds).toEqual([{ name: vec, id: recreated }]);
      } finally {
        await store.disconnect();
      }
    },
  );
});
