import { createVectorErrorId } from '@mastra/core/storage';
import { MongoServerError } from 'mongodb';
import type { Db, Document, MongoClient } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  REGISTRY,
  createRawSearchIndex,
  deferred,
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

  // Keep-the-collection deletes (BYO) coordinate cleanup of shared Atlas Search indexes in a
  // transaction, so a Mastra-created index is never orphaned or dropped while still in use.
  describe('shared search index cleanup on delete', () => {
    const dyn = { mappings: { dynamic: true } };
    const vec = { fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }] };
    let a: MongoDBVector;
    let b: MongoDBVector;
    const colls: string[] = [];

    beforeAll(async () => {
      a = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'cleanup-a' });
      b = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'cleanup-b' });
      await a.connect();
      await b.connect();
    });

    afterAll(async () => {
      await a.disconnect();
      await b.disconnect();
    });

    afterEach(async () => {
      (a as any).testHooks = undefined;
      (b as any).testHooks = undefined;
      for (const c of colls.splice(0)) {
        await db.collection(REGISTRY).deleteMany({ collectionName: c });
        await db.dropCollection(c).catch(() => {});
      }
    });

    const errId = (code: string) => createVectorErrorId('MONGODB', 'DELETE_INDEX', code);
    const reg = (id: string) => db.collection(REGISTRY).findOne({ _id: id as any });
    const regFor = (coll: string) => db.collection(REGISTRY).find({ collectionName: coll }).sort({ _id: 1 }).toArray();

    /** BYO collection with raw search indexes and registrations seeded directly. */
    async function fixture(indexes: Record<string, 'search' | 'vectorSearch'>, entries: Record<string, Document>) {
      const coll = uniqueName('share');
      colls.push(coll);
      await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      for (const [name, type] of Object.entries(indexes))
        await createRawSearchIndex(db, coll, name, type === 'search' ? dyn : vec, type);
      const ids: Record<string, string> = {};
      for (const [key, e] of Object.entries(entries)) {
        ids[key] = `${coll}_${key}`;
        await seedRegistry(db, {
          _id: ids[key],
          indexName: ids[key],
          collectionName: coll,
          searchIndexName: `${coll}_${key}_vec`,
          isByo: true,
          allowWrites: false,
          ownsVectorIndex: false,
          ...e,
        });
      }
      return { coll, X: ids.X!, Y: ids.Y! };
    }

    /** T14 setup: X renamed A -> B (A retired and owned), Y uses A without owning it. */
    const t14 = () =>
      fixture(
        { A: 'search', B: 'search' },
        {
          X: { textSearchIndexName: 'B', ownsTextIndex: true, retiredTextIndexNames: ['A'] },
          Y: { textSearchIndexName: 'A', ownsTextIndex: false },
        },
      );

    /** X owns current text index A; Y uses A without owning it. */
    const handoff = () =>
      fixture(
        { A: 'search' },
        {
          X: { textSearchIndexName: 'A', ownsTextIndex: true },
          Y: { textSearchIndexName: 'A', ownsTextIndex: false },
        },
      );

    /** A hook that parks the call until `release` resolves, signalling `reached` first. */
    function pause() {
      const reached = deferred();
      const release = deferred();
      return {
        reached,
        release,
        hook: async () => {
          reached.resolve();
          await release.promise;
        },
      };
    }

    /** Fails fast instead of hanging when a hook is never called. */
    async function reached(p: { reached: { promise: Promise<void> } }) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        p.reached.promise,
        new Promise((_r, reject) => (timer = setTimeout(() => reject(new Error('hook not reached')), 15_000))),
      ]).finally(() => clearTimeout(timer));
    }

    it('T14: a shared retired index passes to the sibling still using it, and is dropped by the last delete', async () => {
      const { coll, X, Y } = await t14();
      await a.deleteIndex({ indexName: X });
      expect(await searchIndexNames(db, coll)).toEqual(['A']);
      expect(await reg(X)).toBeNull();
      expect((await reg(Y))?.ownsTextIndex).toBe(true);
      await a.deleteIndex({ indexName: Y });
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14a: a recipient already deleting is skipped, so the index it uses is dropped by the other delete', async () => {
      const { coll, X, Y } = await fixture(
        { A: 'search', V: 'vectorSearch' },
        {
          X: { textSearchIndexName: 'A', ownsTextIndex: true },
          Y: { textSearchIndexName: 'A', ownsTextIndex: false, searchIndexName: 'V', ownsVectorIndex: true },
        },
      );
      const p = pause();
      (b as any).testHooks = { afterDeleteStep1: p.hook };
      const deleteY = b.deleteIndex({ indexName: Y });
      await reached(p);
      const y = await reg(Y);
      expect(y).toMatchObject({ deleting: true, ownsVectorIndex: true, ownsTextIndex: false });
      await a.deleteIndex({ indexName: X });
      expect(await searchIndexNames(db, coll)).toEqual(['V']);
      p.release.resolve();
      await deleteY;
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    for (const order of [
      ['X', 'Y'],
      ['Y', 'X'],
    ] as const) {
      it(`T14b: two current co-owners both delete cleanly (${order[0]} paused first)`, async () => {
        const ids = await fixture(
          { A: 'search' },
          {
            X: { textSearchIndexName: 'A', ownsTextIndex: true },
            Y: { textSearchIndexName: 'A', ownsTextIndex: true },
          },
        );
        const p = pause();
        (a as any).testHooks = { afterDeleteCommit: p.hook };
        const first = a.deleteIndex({ indexName: ids[order[0]] });
        await reached(p);
        await b.deleteIndex({ indexName: ids[order[1]] });
        p.release.resolve();
        await first;
        expect(await searchIndexNames(db, ids.coll)).toEqual([]);
        expect(await regFor(ids.coll)).toEqual([]);
      });
    }

    it('T14c: a delete that hands everything off is gone in its transaction, so ownership never bounces back', async () => {
      const { coll, X, Y } = await handoff();
      const p = pause();
      (a as any).testHooks = { afterDeleteCommit: p.hook };
      const deleteX = a.deleteIndex({ indexName: X });
      await reached(p);
      expect(await reg(X)).toBeNull();
      expect((await reg(Y))?.ownsTextIndex).toBe(true);
      await b.deleteIndex({ indexName: Y });
      p.release.resolve();
      await deleteX;
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14d: overlapping delete transactions conflict, one retries, and the result matches the sequential one', async () => {
      const { coll, X, Y } = await t14();
      const release = deferred();
      let arrived = 0;
      const attempts: number[] = [];
      const insideDeleteTransaction = async (_: string, attempt: number) => {
        attempts.push(attempt);
        if (attempt !== 1) return;
        if (++arrived === 2) release.resolve();
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          release.promise,
          new Promise((_r, reject) => (timer = setTimeout(() => reject(new Error('barrier timed out')), 10_000))),
        ]).finally(() => clearTimeout(timer));
      };
      (a as any).testHooks = { insideDeleteTransaction };
      (b as any).testHooks = { insideDeleteTransaction };
      await Promise.all([a.deleteIndex({ indexName: X }), b.deleteIndex({ indexName: Y })]);
      expect(attempts).toContain(2);
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14e: a failed drop keeps the recorded responsibility, blocks re-creation, and a retry finishes', async () => {
      const { coll, Y } = await fixture({ A: 'search' }, { Y: { textSearchIndexName: 'A', ownsTextIndex: true } });
      (a as any).testHooks = {
        beforeDeleteDrop: async () => {
          throw new Error('drop failed');
        },
      };
      const err = await a.deleteIndex({ indexName: Y }).catch(e => e);
      expect(err.id).toBe(errId('FAILED'));
      expect(err.category).toBe('THIRD_PARTY');
      expect(await reg(Y)).toMatchObject({ deleting: true, textSearchIndexName: 'A', ownsTextIndex: true });
      expect(await searchIndexNames(db, coll)).toEqual(['A']);
      (a as any).testHooks = undefined;
      const createErr = await a.createSearchIndex({ indexName: Y }).catch(e => e);
      expect(createErr.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'INDEX_DELETING'));
      expect(createErr.category).toBe('USER');
      expect(createErr.message).toMatch(/deleteIndex/);
      await a.deleteIndex({ indexName: Y });
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14f: a failed transaction capability check changes nothing', async () => {
      const { coll, X } = await t14();
      const before = await regFor(coll);
      (a as any).testHooks = {
        probeTransactions: async () => {
          throw new Error('hello failed');
        },
      };
      const err = await a.deleteIndex({ indexName: X }).catch(e => e);
      expect(err.id).toBe(errId('CAPABILITY_CHECK_FAILED'));
      expect(err.category).toBe('THIRD_PARTY');
      expect(await regFor(coll)).toEqual(before);
      expect((await searchIndexNames(db, coll)).sort()).toEqual(['A', 'B']);
    });

    it('T14i: a stale call never finalizes a recreated registration that a newer delete is handling', async () => {
      const { coll, X } = await fixture(
        { A: 'search', C: 'search' },
        { X: { textSearchIndexName: 'A', ownsTextIndex: true } },
      );
      const p1 = pause();
      (a as any).testHooks = { beforeDeleteFinalize: p1.hook };
      const call1 = a.deleteIndex({ indexName: X });
      await reached(p1);
      const t1 = (await reg(X))?.deleteToken;
      expect(t1).toEqual(expect.any(String));
      await b.deleteIndex({ indexName: X }); // call 2 resumes with t1 and finishes
      expect(await reg(X)).toBeNull();
      await seedRegistry(db, {
        _id: X,
        indexName: X,
        collectionName: coll,
        searchIndexName: `${X}_vec`,
        isByo: true,
        allowWrites: false,
        ownsVectorIndex: false,
        textSearchIndexName: 'C',
        ownsTextIndex: true,
      });
      const p3 = pause();
      (b as any).testHooks = { beforeDeleteFinalize: p3.hook };
      const call3 = b.deleteIndex({ indexName: X });
      await reached(p3);
      const t2 = (await reg(X))?.deleteToken;
      expect(t2).toEqual(expect.any(String));
      expect(t2).not.toBe(t1);
      p1.release.resolve();
      await call1;
      expect(await reg(X)).toMatchObject({ deleting: true, deleteToken: t2 });
      p3.release.resolve();
      await call3;
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14i (before drops): a stale call does not drop the indexes of a recreated registration', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      const p1 = pause();
      (a as any).testHooks = { beforeDeleteDrop: p1.hook };
      const call1 = a.deleteIndex({ indexName: X });
      await reached(p1);
      await b.deleteIndex({ indexName: X });
      expect(await searchIndexNames(db, coll)).toEqual([]);
      await createRawSearchIndex(db, coll, 'A', dyn, 'search');
      await seedRegistry(db, {
        _id: X,
        indexName: X,
        collectionName: coll,
        searchIndexName: `${X}_vec`,
        isByo: true,
        allowWrites: false,
        ownsVectorIndex: false,
        textSearchIndexName: 'A',
        ownsTextIndex: true,
      });
      p1.release.resolve();
      await call1;
      expect(await searchIndexNames(db, coll)).toEqual(['A']);
      expect(await reg(X)).toMatchObject({ textSearchIndexName: 'A', ownsTextIndex: true });
      expect((await reg(X))?.deleting).toBeUndefined();
    });

    describe('T14j: commit outcomes', () => {
      const lostAck = () => {
        const e = new MongoServerError({ message: 'lost ack' });
        e.addErrorLabel('UnknownTransactionCommitResult');
        return e;
      };

      it('lost ack with a drop set: OUTCOME_UNKNOWN, nothing dropped, and a retry finishes', async () => {
        const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
        (a as any).testHooks = {
          afterDeleteCommit: async () => {
            throw lostAck();
          },
        };
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(err.category).toBe('THIRD_PARTY');
        expect(await searchIndexNames(db, coll)).toEqual(['A']);
        expect(await reg(X)).toMatchObject({ deleting: true, deleteToken: expect.any(String) });
        (a as any).testHooks = undefined;
        await a.deleteIndex({ indexName: X });
        expect(await searchIndexNames(db, coll)).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      });

      it('lost ack after handing everything off: OUTCOME_UNKNOWN, entry gone, retry is not found, recipient owns', async () => {
        const { coll, X, Y } = await handoff();
        (a as any).testHooks = {
          afterDeleteCommit: async () => {
            throw lostAck();
          },
        };
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(await reg(X)).toBeNull();
        (a as any).testHooks = undefined;
        const retry = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(retry.id).toBe(errId('NOT_REGISTERED'));
        expect((await reg(Y))?.ownsTextIndex).toBe(true);
        expect(await searchIndexNames(db, coll)).toEqual(['A']);
      });

      it('an unlabelled failure after commit is still OUTCOME_UNKNOWN, and a retry finishes', async () => {
        const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
        (a as any).testHooks = {
          afterDeleteCommit: async () => {
            throw new Error('app crash');
          },
        };
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(await searchIndexNames(db, coll)).toEqual(['A']);
        (a as any).testHooks = undefined;
        await a.deleteIndex({ indexName: X });
        expect(await searchIndexNames(db, coll)).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      });

      it('an abort before commit is FAILED and leaves every registration unchanged', async () => {
        const { coll, X } = await t14();
        const before = await regFor(coll);
        (a as any).testHooks = {
          insideDeleteTransaction: async () => {
            throw new Error('abort');
          },
        };
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('FAILED'));
        expect(await regFor(coll)).toEqual(before);
        expect((await searchIndexNames(db, coll)).sort()).toEqual(['A', 'B']);
      });
    });

    it('T14h: concurrent deletes of the T14 pair always end clean (20 runs)', async () => {
      for (let i = 0; i < 20; i++) {
        const { coll, X, Y } = await t14();
        await Promise.all([a.deleteIndex({ indexName: X }), b.deleteIndex({ indexName: Y })]);
        expect(await searchIndexNames(db, coll)).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      }
    });

    it('T15: a retired-name drop that fails mid-delete is finished by a retry', async () => {
      const { coll, X } = await fixture(
        { A: 'search', B: 'search' },
        { X: { textSearchIndexName: 'B', ownsTextIndex: true, retiredTextIndexNames: ['A'] } },
      );
      (a as any).testHooks = {
        beforeDeleteDrop: async (_: string, name: string) => {
          if (name === 'A') throw new Error('drop A failed');
        },
      };
      const err = await a.deleteIndex({ indexName: X }).catch(e => e);
      expect(err.id).toBe(errId('FAILED'));
      expect(await reg(X)).toMatchObject({ deleting: true, retiredTextIndexNames: ['A'] });
      expect(await searchIndexNames(db, coll)).toContain('A');
      (a as any).testHooks = undefined;
      await a.deleteIndex({ indexName: X });
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await reg(X)).toBeNull();
    });

    it('T17: a BYO delete retried after a partial failure keeps the collection and clears the entry', async () => {
      const { coll, X } = await fixture(
        { A: 'search', V: 'vectorSearch' },
        { X: { textSearchIndexName: 'A', ownsTextIndex: true, searchIndexName: 'V', ownsVectorIndex: true } },
      );
      let drops = 0;
      (a as any).testHooks = {
        beforeDeleteDrop: async () => {
          if (++drops === 2) throw new Error('second drop failed');
        },
      };
      await expect(a.deleteIndex({ indexName: X })).rejects.toMatchObject({ id: errId('FAILED') });
      (a as any).testHooks = undefined;
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
      expect(await searchIndexNames(db, coll)).toEqual([]);
      expect(await db.collection(coll).countDocuments()).toBe(1);
    });

    it('RF2: a BYO collection dropped externally still lets deleteIndex clear the entry', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      await db.dropCollection(coll);
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
    });

    it('RF3: an owned text index dropped by hand still lets deleteIndex clear the entry', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      await db.collection(coll).dropSearchIndex('A');
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
    });

    it('RF5: 50 BYO registrations on one collection delete one after another', async () => {
      const entries = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [
          `r${String(i).padStart(2, '0')}`,
          { textSearchIndexName: 'A', ownsTextIndex: i === 0 },
        ]),
      );
      const { coll } = await fixture({ A: 'search' }, entries);
      for (const key of Object.keys(entries)) await a.deleteIndex({ indexName: `${coll}_${key}` });
      expect(await regFor(coll)).toEqual([]);
      expect(await searchIndexNames(db, coll)).toEqual([]);
    });
  });
});
