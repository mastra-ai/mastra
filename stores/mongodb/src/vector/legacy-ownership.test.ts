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
  settledNames,
  seedCollection,
  seedRegistry,
  uniqueName,
  waitFor,
  dropCollectionWithSearchIndexes,
  hooks,
  listedId,
  recordDrops,
  captureLogs,
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

    await dropCollectionWithSearchIndexes(db, X);
  });

  describe('foreign full-text index reuse', () => {
    const titleDef = {
      mappings: { dynamic: false, fields: { metadata: { type: 'document', fields: { title: [{ type: 'string' }] } } } },
    };
    const created: string[] = [];

    afterEach(async () => {
      for (const n of created.splice(0)) {
        await db.collection(REGISTRY).deleteOne({ _id: n as any });
        await dropCollectionWithSearchIndexes(db, n).catch(() => {});
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

    it('T12-dynamic: a foreign dynamic index echoed with fields:{} is reused by a no-fields attach', async () => {
      const { coll, indexName } = await setup({ mappings: { dynamic: true } }, true);
      await store.createSearchIndex({ indexName, searchIndexName: 'docs_fts' });
      const reg = await db.collection(REGISTRY).findOne({ _id: indexName as any });
      expect(reg?.ownsTextIndex).not.toBe(true);
      expect(await searchIndexNames(db, coll)).toContain('docs_fts');
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
        await dropCollectionWithSearchIndexes(db, c).catch(() => {});
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
      expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
      expect(await reg(X)).toBeNull();
      expect((await reg(Y))?.ownsTextIndex).toBe(true);
      await a.deleteIndex({ indexName: Y });
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('a delete drops its exclusive vector index but keeps a text index a sibling still uses, which the last delete drops', async () => {
      const { coll, X, Y } = await fixture(
        { A: 'search', V: 'vectorSearch' },
        {
          X: { textSearchIndexName: 'A', ownsTextIndex: true, searchIndexName: 'V', ownsVectorIndex: true },
          Y: { textSearchIndexName: 'A', ownsTextIndex: false },
        },
      );
      await a.deleteIndex({ indexName: X });
      expect((await searchIndexNames(db, coll)).sort()).toEqual(['A']);
      expect(await reg(X)).toBeNull();
      expect((await reg(Y))?.ownsTextIndex).toBe(true);
      await a.deleteIndex({ indexName: Y });
      expect(await settledNames(db, coll, [])).toEqual([]);
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
      try {
        await reached(p);
        const y = await reg(Y);
        expect(y).toMatchObject({ deleting: true, ownsVectorIndex: true, ownsTextIndex: false });
        await a.deleteIndex({ indexName: X });
        expect(await settledNames(db, coll, ['V'])).toEqual(['V']);
      } finally {
        // Settle the parked delete before teardown removes its fixture, even when an assertion failed.
        p.release.resolve();
        await deleteY.catch(() => {});
      }
      await deleteY;
      expect(await settledNames(db, coll, [])).toEqual([]);
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
        expect(await settledNames(db, ids.coll, [])).toEqual([]);
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
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14d: overlapping delete transactions conflict, one retries, and the result matches the sequential one', async () => {
      const { coll, X, Y } = await t14();
      // Entries with a generation: a delete that read an entry without one and finds one on its
      // retry (here X's transfer backfills Y's) cannot tell a backfill from a replacement, and
      // refuses with a retryable CONFLICT instead (provisioning-protocol.test.ts).
      await db.collection(REGISTRY).updateMany({ collectionName: coll }, [{ $set: { generation: '$_id' } }]);
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
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
    });

    it('T14e: a failed drop keeps the recorded responsibility, blocks re-creation, and a retry finishes', async () => {
      const { coll, Y } = await fixture({ A: 'search' }, { Y: { textSearchIndexName: 'A', ownsTextIndex: true } });
      const A = await listedId(db, coll, 'A');
      hooks(a, {
        beforeDeleteDrop: async () => {
          throw new Error('drop failed');
        },
      });
      const { drops } = recordDrops(a);
      const err = await a.deleteIndex({ indexName: Y }).catch(e => e);
      expect(err.id).toBe(errId('FAILED'));
      expect(err.category).toBe('THIRD_PARTY');
      expect(await reg(Y)).toMatchObject({ deleting: true, textSearchIndexName: 'A', ownsTextIndex: true });
      expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
      hooks(a, { beforeDeleteDrop: undefined });
      const createErr = await a.createSearchIndex({ indexName: Y }).catch(e => e);
      expect(createErr.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'INDEX_DELETING'));
      expect(createErr.category).toBe('USER');
      expect(createErr.message).toMatch(/deleteIndex/);
      await a.deleteIndex({ indexName: Y });
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
      // No recorded id: dropped by the id listed for the name (§3.7).
      expect(drops).toEqual([{ collectionName: coll, name: 'A', id: A }]);
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
      const ids = { A: await listedId(db, coll, 'A'), C: await listedId(db, coll, 'C') };
      const dropsA = recordDrops(a).drops;
      const dropsB = recordDrops(b).drops;
      const p1 = pause();
      hooks(a, { beforeDeleteFinalize: p1.hook });
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
      hooks(b, { beforeDeleteFinalize: p3.hook });
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
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await regFor(coll)).toEqual([]);
      expect(dropsA).toEqual([{ collectionName: coll, name: 'A', id: ids.A }]);
      // Call 2 resumes call 1's attempt and retries A by its recorded id, a no-op since A is gone.
      expect(dropsB).toEqual([
        { collectionName: coll, name: 'A', id: ids.A },
        { collectionName: coll, name: 'C', id: ids.C },
      ]);
    });

    it('T14i (before drops): a stale call does not drop the indexes of a recreated registration', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      const A = await listedId(db, coll, 'A');
      const dropsA = recordDrops(a).drops;
      const dropsB = recordDrops(b).drops;
      const p1 = pause();
      hooks(a, { beforeDeleteDrop: p1.hook });
      const call1 = a.deleteIndex({ indexName: X });
      await reached(p1);
      await b.deleteIndex({ indexName: X });
      expect(await settledNames(db, coll, [])).toEqual([]);
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
      expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
      expect(await reg(X)).toMatchObject({ textSearchIndexName: 'A', ownsTextIndex: true });
      expect((await reg(X))?.deleting).toBeUndefined();
      expect(dropsA).toEqual([]);
      expect(dropsB).toEqual([{ collectionName: coll, name: 'A', id: A }]);
    });

    describe('T14j: commit outcomes', () => {
      const lostAck = () => {
        const e = new MongoServerError({ message: 'lost ack' });
        e.addErrorLabel('UnknownTransactionCommitResult');
        return e;
      };

      it('lost ack with a drop set: OUTCOME_UNKNOWN, nothing dropped, and a retry finishes', async () => {
        const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
        const A = await listedId(db, coll, 'A');
        const { drops } = recordDrops(a);
        hooks(a, {
          afterDeleteCommit: async () => {
            throw lostAck();
          },
        });
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(err.category).toBe('THIRD_PARTY');
        expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
        expect(await reg(X)).toMatchObject({ deleting: true, deleteToken: expect.any(String) });
        hooks(a, { afterDeleteCommit: undefined });
        await a.deleteIndex({ indexName: X });
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
        expect(drops).toEqual([{ collectionName: coll, name: 'A', id: A }]);
      });

      it('lost ack after handing everything off: OUTCOME_UNKNOWN, entry gone, retry is not found, recipient owns', async () => {
        const { coll, X, Y } = await handoff();
        const { drops } = recordDrops(a);
        hooks(a, {
          afterDeleteCommit: async () => {
            throw lostAck();
          },
        });
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(await reg(X)).toBeNull();
        hooks(a, { afterDeleteCommit: undefined });
        const retry = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(retry.id).toBe(errId('NOT_REGISTERED'));
        expect((await reg(Y))?.ownsTextIndex).toBe(true);
        expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
        expect(drops).toEqual([]);
      });

      it('an unlabelled failure after commit is still OUTCOME_UNKNOWN, and a retry finishes', async () => {
        const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
        const A = await listedId(db, coll, 'A');
        const { drops } = recordDrops(a);
        hooks(a, {
          afterDeleteCommit: async () => {
            throw new Error('app crash');
          },
        });
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('OUTCOME_UNKNOWN'));
        expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
        hooks(a, { afterDeleteCommit: undefined });
        await a.deleteIndex({ indexName: X });
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
        expect(drops).toEqual([{ collectionName: coll, name: 'A', id: A }]);
      });

      it('an abort before commit is FAILED and leaves every registration unchanged', async () => {
        const { coll, X } = await t14();
        const before = await regFor(coll);
        const { drops } = recordDrops(a);
        hooks(a, {
          insideDeleteTransaction: async () => {
            throw new Error('abort');
          },
        });
        const err = await a.deleteIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('FAILED'));
        expect(await regFor(coll)).toEqual(before);
        expect((await searchIndexNames(db, coll)).sort()).toEqual(['A', 'B']);
        expect(drops).toEqual([]);
      });
    });

    it('T14h: concurrent deletes of the T14 pair always end clean (20 runs)', async () => {
      for (let i = 0; i < 20; i++) {
        const { coll, X, Y } = await t14();
        // The fixture has no generation; one delete's handover backfills it on the sibling, so the
        // other may refuse with the documented retryable CONFLICT. Retry as the error says.
        const del = (s: MongoDBVector, indexName: string) =>
          s
            .deleteIndex({ indexName })
            .catch(e => (e?.id === errId('CONFLICT') ? s.deleteIndex({ indexName }) : Promise.reject(e)));
        await Promise.all([del(a, X), del(b, Y)]);
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      }
    });

    for (const recreated of [
      { label: 'BYO', fields: { isByo: true, allowWrites: false } },
      { label: 'managed', fields: { isByo: false, allowWrites: true, ownsCollection: true } },
    ]) {
      it(`a stale delete leaves X alone after it is recreated on another collection (${recreated.label})`, async () => {
        const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
        const c2 = uniqueName('share');
        colls.push(c2);
        await seedCollection(db, c2, [{ title: 'b' }]);
        await createRawSearchIndex(db, c2, 'Z', dyn, 'search');
        const newX = {
          _id: X,
          indexName: X,
          collectionName: c2,
          searchIndexName: `${c2}_vec`,
          ownsVectorIndex: false,
          textSearchIndexName: 'Z',
          ownsTextIndex: true,
          rev: 7,
          ...recreated.fields,
        };
        (a as any).testHooks = {
          // Between the pre-read and T1: another call finishes X, then the app recreates it on c2.
          insideDeleteTransaction: async (_: string, attempt: number) => {
            if (attempt !== 1) return;
            await db.collection(REGISTRY).deleteOne({ _id: X as any });
            await seedRegistry(db, newX);
          },
        };
        await a.deleteIndex({ indexName: X });
        expect(await reg(X)).toEqual(newX);
        expect(await settledNames(db, c2, ['Z'])).toEqual(['Z']);
        expect(await settledNames(db, coll, ['A'])).toEqual(['A']);
      });
    }

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
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await reg(X)).toBeNull();
    });

    // PR #30067 review: a resumed delete listed an ID-less legacy name again, so an index created
    // under that name after the first attempt was dropped.
    it('T15b: a resumed delete leaves an index recreated under a legacy name it already dropped', async () => {
      const { coll, X } = await fixture(
        { A: 'search', B: 'search' },
        { X: { textSearchIndexName: 'B', ownsTextIndex: true, retiredTextIndexNames: ['A'] } },
      );
      const original: Record<string, string | undefined> = {
        A: await listedId(db, coll, 'A'),
        B: await listedId(db, coll, 'B'),
      };
      const dropped: string[] = [];
      (a as any).testHooks = {
        beforeDeleteDrop: async (_: string, name: string) => {
          if (dropped.length === 1) throw new Error('second drop failed');
          dropped.push(name);
        },
      };
      await expect(a.deleteIndex({ indexName: X })).rejects.toMatchObject({ id: errId('FAILED') });
      (a as any).testHooks = undefined;
      const first = dropped[0]!;
      // Someone else creates an index under the name the first attempt dropped.
      await waitFor(() =>
        createRawSearchIndex(db, coll, first, dyn, 'search').then(
          () => true,
          () => false,
        ),
      );
      const recreated = await listedId(db, coll, first);
      expect(recreated).toEqual(expect.any(String));
      expect(recreated).not.toBe(original[first]);
      // Checked on the drop commands, since a wrongly dropped index can stay listed as DELETING.
      const { drops } = recordDrops(a);
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
      expect(drops.map(d => d.id)).not.toContain(recreated);
      expect(await listedId(db, coll, first)).toBe(recreated);
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
      expect(await settledNames(db, coll, [])).toEqual([]);
      expect(await db.collection(coll).countDocuments()).toBe(1);
    });

    it('RF2: a BYO collection dropped externally still lets deleteIndex clear the entry', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      await dropCollectionWithSearchIndexes(db, coll);
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
    });

    it('RF3: an owned text index dropped by hand still lets deleteIndex clear the entry', async () => {
      const { coll, X } = await fixture({ A: 'search' }, { X: { textSearchIndexName: 'A', ownsTextIndex: true } });
      await db.collection(coll).dropSearchIndex('A');
      await a.deleteIndex({ indexName: X });
      expect(await reg(X)).toBeNull();
    });

    /** A BYO registration whose id equals its collection name, with an owned vector index V and optional text index A. */
    async function sameName(withText: boolean) {
      const coll = uniqueName('same');
      colls.push(coll);
      await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      await createRawSearchIndex(db, coll, 'V', vec, 'vectorSearch');
      if (withText) await createRawSearchIndex(db, coll, 'A', dyn, 'search');
      await createRawSearchIndex(db, coll, 'F', dyn, 'search'); // foreign, unregistered
      await seedRegistry(db, {
        _id: coll,
        indexName: coll,
        collectionName: coll,
        searchIndexName: 'V',
        isByo: true,
        allowWrites: false,
        ownsVectorIndex: true,
        ...(withText ? { textSearchIndexName: 'A', ownsTextIndex: true } : {}),
      });
      return coll;
    }

    it('a BYO delete with collectionName === indexName drops only the indexes it owns and keeps the collection', async () => {
      const coll = await sameName(true);
      await a.deleteIndex({ indexName: coll });
      expect(await reg(coll)).toBeNull();
      expect(await settledNames(db, coll, ['F'])).toEqual(['F']);
      expect(await db.collection(coll).countDocuments()).toBe(1);
    });

    it('a BYO delete without a text index never drops one it does not own', async () => {
      const coll = await sameName(false);
      await a.deleteIndex({ indexName: coll });
      expect(await reg(coll)).toBeNull();
      expect(await settledNames(db, coll, ['F'])).toEqual(['F']);
    });

    it('restart durability: a fresh store with an empty cache deletes a BYO index from the registry', async () => {
      const coll = await sameName(true);
      const fresh = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'cleanup-fresh' });
      await fresh.connect();
      try {
        await fresh.deleteIndex({ indexName: coll });
      } finally {
        await fresh.disconnect();
      }
      expect(await reg(coll)).toBeNull();
      expect(await settledNames(db, coll, ['F'])).toEqual(['F']);
      expect(await db.collection(coll).countDocuments()).toBe(1);
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
      expect(await settledNames(db, coll, [])).toEqual([]);
    });

    // Managed deletes drop the whole collection, so they need recorded ownership and no other user.
    // A registration that starts using a search index after a delete committed its drop set must not
    // lose it: the delete re-checks for users right before each drop and hands the index over, and
    // the attaching call re-checks for pending drops right after its write and refuses. Whichever
    // reads second sees the other.
    describe('attach during a pending drop', () => {
      const deleting = (op: string) => createVectorErrorId('MONGODB', op, 'INDEX_DELETING');
      /** X owns the vector index S on a BYO collection; Y will attach to S. */
      async function shared() {
        const ids = await fixture({ S: 'vectorSearch' }, { X: { searchIndexName: 'S', ownsVectorIndex: true } });
        return { ...ids, Y: `${ids.coll}_Y` };
      }
      const attachY = (coll: string, Y: string) =>
        b.createIndex({ indexName: Y, dimension: 4, collectionName: coll, searchIndexName: 'S' });

      it('T-R1: a registration that attaches while the delete decides takes the index over, and its own delete drops it', async () => {
        const { coll, X, Y } = await shared();
        const del = pause();
        (a as any).testHooks = {
          insideDeleteTransaction: async (_: string, attempt: number) => attempt === 1 && del.hook(),
        };
        const deleteX = a.deleteIndex({ indexName: X });
        // The delete has read its siblings (Y is not among them) but not yet committed its drop set,
        // so Y's createIndex finds no pending drop and attaches to S.
        await reached(del);
        await attachY(coll, Y);
        expect(await reg(Y)).toMatchObject({ searchIndexName: 'S' });
        del.release.resolve();
        await deleteX;
        expect(await settledNames(db, coll, ['S'])).toEqual(['S']);
        expect(await reg(X)).toBeNull();
        expect(await reg(Y)).toMatchObject({ searchIndexName: 'S', ownsVectorIndex: true });
        await b.deleteIndex({ indexName: Y });
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      });

      it('T-R1 (attach check pending): a delete that sees a just-written registration hands the index over instead of dropping it', async () => {
        const { coll, X, Y } = await shared();
        const del = pause();
        const att = pause();
        (a as any).testHooks = { afterDeleteStep1: del.hook };
        (b as any).testHooks = { beforePendingDropCheck: att.hook };
        const deleteX = a.deleteIndex({ indexName: X });
        await reached(del);
        const createY = attachY(coll, Y);
        // Y's registration is written; its pending-drop check has not run yet.
        await reached(att);
        del.release.resolve();
        await deleteX;
        // Handed over, not dropped: S is still the index X created, and Y is responsible for it.
        expect(await settledNames(db, coll, ['S'])).toEqual(['S']);
        expect(await reg(Y)).toMatchObject({ searchIndexName: 'S', ownsVectorIndex: true });
        att.release.resolve();
        await createY;
        expect(await reg(X)).toBeNull();
        expect(await reg(Y)).toMatchObject({ searchIndexName: 'S', ownsVectorIndex: true });
      });

      it('T-R1 (converse): a createIndex attaching to an index a delete is about to drop refuses with INDEX_DELETING, and the delete drops it', async () => {
        const { coll, X, Y } = await shared();
        const del = pause();
        (a as any).testHooks = { afterDeleteStep1: del.hook };
        const deleteX = a.deleteIndex({ indexName: X });
        await reached(del);
        const err = await attachY(coll, Y).catch(e => e);
        expect(err.id).toBe(deleting('CREATE_INDEX'));
        expect(err.category).toBe('USER');
        expect(await reg(Y)).toBeNull();
        del.release.resolve();
        await deleteX;
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      });

      it('T-R1 (both see each other): the attach refuses and rolls back, and the delete then finds no user and drops', async () => {
        const { coll, X, Y } = await shared();
        const del = pause();
        const del2 = pause();
        const att = pause();
        (a as any).testHooks = { afterDeleteStep1: del.hook, beforeDeleteHandover: del2.hook };
        (b as any).testHooks = { beforePendingDropCheck: att.hook };
        const deleteX = a.deleteIndex({ indexName: X });
        await reached(del);
        const createY = attachY(coll, Y).catch(e => e);
        await reached(att);
        del.release.resolve();
        // The delete has seen Y and is about to hand S over; Y now checks and still sees S pending.
        await reached(del2);
        att.release.resolve();
        expect((await createY).id).toBe(deleting('CREATE_INDEX'));
        expect(await reg(Y)).toBeNull();
        del2.release.resolve();
        await deleteX;
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([]);
      });

      it('T-R1 (createSearchIndex): attaching a text index a delete is about to drop refuses and restores the entry', async () => {
        const { coll, X, Y } = await fixture(
          { A: 'search' },
          { X: { textSearchIndexName: 'A', ownsTextIndex: true }, Y: { claimToken: 'y' } },
        );
        const del = pause();
        (a as any).testHooks = { afterDeleteStep1: del.hook };
        const deleteX = a.deleteIndex({ indexName: X });
        await reached(del);
        const before = await reg(Y);
        const err = await b.createSearchIndex({ indexName: Y, searchIndexName: 'A' }).catch(e => e);
        expect(err.id).toBe(deleting('CREATE_SEARCH_INDEX'));
        // The rollback restores the fields the call wrote; it keeps the generation its write
        // backfilled, bumps rev past that write and sets a fresh claimToken (I4).
        const restored = await reg(Y);
        expect(typeof restored?.generation).toBe('string');
        expect(restored?.claimToken).not.toBe(before?.claimToken);
        expect(restored).toEqual({
          ...before,
          generation: restored?.generation,
          rev: (before?.rev ?? 0) + 2,
          claimToken: restored?.claimToken,
        });
        del.release.resolve();
        await deleteX;
        expect(await settledNames(db, coll, [])).toEqual([]);
        expect(await regFor(coll)).toEqual([restored]);
      });
    });

    describe('managed collection deletes', () => {
      const docs = () => [{ title: 'a' }, { title: 'b' }, { title: 'c' }];
      const exists = (c: string) => db.listCollections({ name: c }).hasNext();
      // Released after every test, so a failed assertion never leaves a call parked into the next test.
      const pauses: ReturnType<typeof pause>[] = [];
      const held = () => {
        const p = pause();
        pauses.push(p);
        return p;
      };
      afterEach(() => {
        for (const p of pauses.splice(0)) p.release.resolve();
      });

      /** A managed collection with 3 documents and its registration seeded directly. */
      async function managed(owns: boolean | 'unknown' = true, extra: Document = {}) {
        const coll = uniqueName('mgd');
        colls.push(coll);
        await seedCollection(db, coll, docs());
        const entry = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: `${coll}_vector_index`,
          isByo: false,
          allowWrites: true,
          ownsVectorIndex: true,
          ...(owns === 'unknown' ? {} : { ownsCollection: owns }),
          ...extra,
        };
        await seedRegistry(db, entry);
        return { coll, entry };
      }

      it('T13a-1: a flagless managed entry refuses with OWNERSHIP_UNKNOWN and drops nothing', async () => {
        const { coll, entry } = await managed('unknown');
        const err = await a.deleteIndex({ indexName: coll }).catch(e => e);
        expect(err.id).toBe(errId('OWNERSHIP_UNKNOWN'));
        expect(err.category).toBe('USER');
        expect(err.message).toMatch(/claimLegacyIndex/);
        expect(await exists(coll)).toBe(true);
        expect(await db.collection(coll).countDocuments()).toBe(3);
        expect(await reg(coll)).toEqual(entry);
      });

      it('a managed delete whose collection was already dropped externally still clears the entry', async () => {
        const { coll } = await managed(true);
        await dropCollectionWithSearchIndexes(db, coll);
        await a.deleteIndex({ indexName: coll });
        expect(await reg(coll)).toBeNull();
      });

      it('T13a-2: after claimLegacyIndex, deleteIndex drops the flagless managed collection', async () => {
        const { coll } = await managed('unknown');
        await a.claimLegacyIndex({ indexName: coll });
        await a.deleteIndex({ indexName: coll });
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
      });

      it('T16: a managed delete refuses with IN_USE while a BYO index uses its collection', async () => {
        const { coll, entry } = await managed();
        await seedRegistry(db, {
          _id: `${coll}_byo`,
          indexName: `${coll}_byo`,
          collectionName: coll,
          searchIndexName: `${coll}_byo_vec`,
          isByo: true,
          allowWrites: false,
          ownsVectorIndex: false,
        });
        const err = await a.deleteIndex({ indexName: coll }).catch(e => e);
        expect(err.id).toBe(errId('IN_USE'));
        expect(err.category).toBe('USER');
        expect(await exists(coll)).toBe(true);
        expect(await db.collection(coll).countDocuments()).toBe(3);
        expect(await reg(coll)).toEqual(entry);
      });

      it('T14g: two claimed managed entries on one collection each refuse with IN_USE', async () => {
        const { coll } = await managed();
        const second = `${coll}_2`;
        await seedRegistry(db, {
          _id: second,
          indexName: second,
          collectionName: coll,
          searchIndexName: `${second}_vector_index`,
          isByo: false,
          allowWrites: true,
          ownsVectorIndex: true,
          ownsCollection: true,
        });
        for (const indexName of [coll, second]) {
          await expect(a.deleteIndex({ indexName })).rejects.toMatchObject({ id: errId('IN_USE') });
        }
        expect(await exists(coll)).toBe(true);
        expect(await regFor(coll)).toHaveLength(2);
      });

      it('T14i-M (stale finalization): a stale call leaves a recreated managed registration alone', async () => {
        const { coll, entry } = await managed();
        const p1 = held();
        (a as any).testHooks = { beforeDeleteFinalize: p1.hook };
        const call1 = a.deleteIndex({ indexName: coll });
        await reached(p1);
        const t1 = (await reg(coll))?.deleteToken;
        expect(t1).toEqual(expect.any(String));
        await b.deleteIndex({ indexName: coll }); // call 2 resumes with t1 and finishes
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
        await seedCollection(db, coll, docs());
        await seedRegistry(db, entry);
        const p3 = held();
        (b as any).testHooks = { afterDeleteStep1: p3.hook };
        const call3 = b.deleteIndex({ indexName: coll });
        await reached(p3);
        const t2 = (await reg(coll))?.deleteToken;
        expect(t2).toEqual(expect.any(String));
        expect(t2).not.toBe(t1);
        p1.release.resolve();
        await call1;
        expect(await reg(coll)).toMatchObject({ deleting: true, deleteToken: t2 });
        expect(await db.collection(coll).countDocuments()).toBe(3);
        p3.release.resolve();
        await call3;
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
      });

      it('T14i-M (stale physical drop): a stale call does not drop a recreated managed collection', async () => {
        const { coll, entry } = await managed();
        const p1 = held();
        (a as any).testHooks = { beforeDeleteDrop: p1.hook };
        const call1 = a.deleteIndex({ indexName: coll });
        await reached(p1);
        await b.deleteIndex({ indexName: coll });
        expect(await exists(coll)).toBe(false);
        await seedCollection(db, coll, docs());
        await seedRegistry(db, entry);
        p1.release.resolve();
        await call1;
        expect(await db.collection(coll).countDocuments()).toBe(3);
        expect(await reg(coll)).toEqual(entry);
      });

      it('T14i-M (resume): a deleting managed entry finishes with its stored token', async () => {
        const { coll } = await managed(true, { deleting: true, deleteToken: 't' });
        let seen: string | undefined;
        (a as any).testHooks = {
          beforeDeleteDrop: async () => {
            seen = (await reg(coll))?.deleteToken;
          },
        };
        await a.deleteIndex({ indexName: coll });
        expect(seen).toBe('t');
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
      });

      it('T14k-M: a resumed delete re-checks IN_USE, keeps its token, and finishes once the user is gone', async () => {
        const { coll } = await managed(true, { deleting: true, deleteToken: 't' });
        const byo = `${coll}_byo`;
        await seedRegistry(db, {
          _id: byo,
          indexName: byo,
          collectionName: coll,
          searchIndexName: `${byo}_vec`,
          isByo: true,
          allowWrites: false,
          ownsVectorIndex: false,
        });
        const err = await a.deleteIndex({ indexName: coll }).catch(e => e);
        expect(err.id).toBe(errId('IN_USE'));
        expect(err.category).toBe('USER');
        expect(await db.collection(coll).countDocuments()).toBe(3);
        expect(await reg(coll)).toMatchObject({ deleting: true, deleteToken: 't' });
        await db.collection(REGISTRY).deleteOne({ _id: byo as any });
        await a.deleteIndex({ indexName: coll });
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
      });

      for (const recreated of [
        { label: 'BYO', fields: { isByo: true, allowWrites: false } },
        { label: 'ownsCollection: false', fields: { isByo: false, allowWrites: true, ownsCollection: false } },
      ]) {
        it(`T14l-M: a stale T1 leaves X alone after it is recreated on the same collection (${recreated.label})`, async () => {
          const { coll } = await managed();
          const newX = {
            _id: coll,
            indexName: coll,
            collectionName: coll,
            searchIndexName: `${coll}_vec`,
            ownsVectorIndex: false,
            rev: 7,
            ...recreated.fields,
          };
          (a as any).testHooks = {
            // Between the pre-read and T1: another call finishes X, then the app recreates it.
            insideDeleteTransaction: async (_: string, attempt: number) => {
              if (attempt !== 1) return;
              await db.collection(REGISTRY).deleteOne({ _id: coll as any });
              await seedRegistry(db, newX);
            },
          };
          await a.deleteIndex({ indexName: coll });
          expect(await reg(coll)).toEqual(newX);
          expect(await db.collection(coll).countDocuments()).toBe(3);
        });
      }

      it('T14m-M: a T1 that finds X already deleting continues that token and drops once', async () => {
        const { coll } = await managed();
        const seen: (string | undefined)[] = [];
        (a as any).testHooks = {
          // Another call's T1 commits between this call's pre-read and its own T1.
          insideDeleteTransaction: async (_: string, attempt: number) => {
            if (attempt !== 1) return;
            await db
              .collection(REGISTRY)
              .updateOne({ _id: coll as any }, { $set: { deleting: true, deleteToken: 't' }, $inc: { rev: 1 } });
          },
          beforeDeleteDrop: async () => {
            seen.push((await reg(coll))?.deleteToken);
          },
        };
        await a.deleteIndex({ indexName: coll });
        expect(seen).toEqual(['t']);
        expect(await exists(coll)).toBe(false);
        expect(await reg(coll)).toBeNull();
      });

      it('T14i-M (createIndex): a deleting managed entry refuses before recreating its dropped collection', async () => {
        const { coll } = await managed(true, { deleting: true, deleteToken: 't' });
        await dropCollectionWithSearchIndexes(db, coll);
        const err = await a.createIndex({ indexName: coll, dimension: 4 }).catch(e => e);
        expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
        expect(await exists(coll)).toBe(false);
      });

      describe('text index rename (T13)', () => {
        async function byo() {
          const coll = uniqueName('ren');
          colls.push(coll);
          await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
          await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
          return coll;
        }
        const entry = (coll: string) => db.collection(REGISTRY).findOne({ _id: coll as any });

        it('T13: A -> B -> A reactivates A as owned, then deleteIndex removes A and B', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'B' });
          expect(await entry(coll)).toMatchObject({ textSearchIndexName: 'B', retiredTextIndexNames: ['A'] });
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          expect(await entry(coll)).toMatchObject({
            ownsTextIndex: true,
            textSearchIndexName: 'A',
            retiredTextIndexNames: ['B'],
          });
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A', fields: ['title'] });
          const [idx] = await db.collection(coll).listSearchIndexes('A').toArray();
          expect(idx!.latestDefinition.mappings.dynamic).toBe(false);
          await a.deleteIndex({ indexName: coll });
          const names = await searchIndexNames(db, coll);
          expect(names).not.toContain('A');
          expect(names).not.toContain('B');
        });

        it('T13-rollback: a failed rename restores the renamed fields and bumps rev', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          const before = await entry(coll);
          (a as any).testHooks = {
            beforeSearchIndexProvision: async () => {
              throw new Error('provision failed');
            },
          };
          await expect(a.createSearchIndex({ indexName: coll, searchIndexName: 'B' })).rejects.toThrow();
          const after = await entry(coll);
          // The rename's write and the rollback each bump rev; neither lowers it (I4).
          expect(after).toEqual({ ...before, rev: before!.rev + 2, claimToken: after?.claimToken });
          expect(after?.claimToken).not.toBe(before?.claimToken);
        });

        it('a rollback after a delete transaction committed leaves the delete state intact', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          (a as any).testHooks = {
            beforeSearchIndexProvision: async () => {
              // What a committed delete T1 writes: deleting, deleteToken and a rev bump, never claimToken.
              await db
                .collection(REGISTRY)
                .updateOne({ _id: coll as any }, { $set: { deleting: true, deleteToken: 't' }, $inc: { rev: 1 } });
              throw new Error('provision failed');
            },
          };
          const rev = (await entry(coll))?.rev ?? 0;
          const call = a.createSearchIndex({ indexName: coll, searchIndexName: 'B' });
          await expect(call).rejects.toThrow('provision failed');
          expect(await entry(coll)).toMatchObject({
            deleting: true,
            deleteToken: 't',
            // The rename's own write bumps rev too (I5), then the delete's.
            rev: rev + 2,
            textSearchIndexName: 'B',
          });
        });

        it('a rename refuses with INDEX_DELETING when a delete starts after its read, and changes nothing', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          let marked: Document | null = null;
          (a as any).testHooks = {
            afterCreateSearchIndexRead: async () => {
              await db
                .collection(REGISTRY)
                .updateOne({ _id: coll as any }, { $set: { deleting: true, deleteToken: 't' }, $inc: { rev: 1 } });
              marked = await entry(coll);
            },
          };
          const err = await a.createSearchIndex({ indexName: coll, searchIndexName: 'B' }).catch(e => e);
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'INDEX_DELETING'));
          expect(await entry(coll)).toEqual(marked);
          expect(await searchIndexNames(db, coll)).not.toContain('B');
        });

        it('a rename refuses with CONFLICT when the entry vanishes after its read, and writes nothing', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          (a as any).testHooks = {
            afterCreateSearchIndexRead: async () => {
              await db.collection(REGISTRY).deleteOne({ _id: coll as any });
            },
          };
          const err = await a.createSearchIndex({ indexName: coll, searchIndexName: 'B' }).catch(e => e);
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(err.category).toBe('USER');
          expect(await entry(coll)).toBeNull();
          expect(await searchIndexNames(db, coll)).not.toContain('B');
        });

        it('T-R2: a rename that read the entry before another call renamed it refuses with CONFLICT and keeps the other rename', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          const p = pause();
          (a as any).testHooks = {
            afterCreateSearchIndexRead: p.hook,
            beforeSearchIndexProvision: async () => {
              throw new Error('provision failed');
            },
          };
          const toC = a.createSearchIndex({ indexName: coll, searchIndexName: 'C' }).catch(e => e);
          await reached(p);
          await b.createSearchIndex({ indexName: coll, searchIndexName: 'B' });
          p.release.resolve();
          const err = await toC;
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(err.category).toBe('USER');
          expect(await entry(coll)).toMatchObject({
            textSearchIndexName: 'B',
            ownsTextIndex: true,
            retiredTextIndexNames: ['A'],
          });
          expect((await searchIndexNames(db, coll)).sort()).toEqual(['A', 'B', `${coll}_vector_index`]);
          (a as any).testHooks = undefined;
          await a.deleteIndex({ indexName: coll });
          expect(await settledNames(db, coll, [])).toEqual([]);
          expect(await entry(coll)).toBeNull();
        });

        it('T-R3: a same-name refresh whose registration is deleted after its read refuses with CONFLICT and recreates nothing', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          const p = pause();
          (a as any).testHooks = { afterCreateSearchIndexRead: p.hook };
          const refresh = a
            .createSearchIndex({ indexName: coll, searchIndexName: 'A', fields: ['title'] })
            .catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: coll });
          expect(await settledNames(db, coll, [])).toEqual([]);
          p.release.resolve();
          const err = await refresh;
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(await entry(coll)).toBeNull();
          expect(await settledNames(db, coll, [])).toEqual([]);
        });

        // The registration is removed after the call's write but before it provisions: provisioning
        // then would leave a search index on the caller's collection that nothing records.
        it('T-R3b: a same-name refresh whose registration is deleted after its write refuses with CONFLICT and recreates nothing', async () => {
          const coll = await byo();
          await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
          const p = pause();
          (a as any).testHooks = { beforePendingDropCheck: p.hook };
          const refresh = a
            .createSearchIndex({ indexName: coll, searchIndexName: 'A', fields: ['title'] })
            .catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: coll });
          expect(await settledNames(db, coll, [])).toEqual([]);
          p.release.resolve();
          const err = await refresh;
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(await entry(coll)).toBeNull();
          expect(await settledNames(db, coll, [])).toEqual([]);
        });

        it('T-R3c: a createIndex refresh whose registration is deleted after its write refuses with CONFLICT and recreates nothing', async () => {
          const coll = await byo();
          const p = pause();
          (a as any).testHooks = { beforePendingDropCheck: p.hook };
          const refresh = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: coll });
          expect(await settledNames(db, coll, [])).toEqual([]);
          p.release.resolve();
          const err = await refresh;
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
          expect(await entry(coll)).toBeNull();
          expect(await settledNames(db, coll, [])).toEqual([]);
        });

        it('T-R3d: a createIndex refresh never rewrites an entry whose delete started after its read', async () => {
          const coll = await byo();
          let marked: Document | null = null;
          (a as any).testHooks = {
            afterCreateIndexRead: async () => {
              await db
                .collection(REGISTRY)
                .updateOne({ _id: coll as any }, { $set: { deleting: true, deleteToken: 't' }, $inc: { rev: 1 } });
              marked = await entry(coll);
            },
          };
          const err = await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
          expect(await entry(coll)).toEqual(marked);
        });

        // A rollback restores the document the call read. An ownership write by another call in
        // between keeps the claimToken, so only its `rev` bump stops the rollback from erasing it.
        it('I-2: a failed createSearchIndex never undoes the vector ownership a concurrent createIndex recorded', async () => {
          const coll = uniqueName('own');
          colls.push(coll);
          await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
          const pb = pause();
          const pa = pause();
          (b as any).testHooks = { beforePendingDropCheck: pb.hook };
          (a as any).testHooks = {
            afterCreateSearchIndexRead: pa.hook,
            beforeSearchIndexProvision: async () => {
              throw new Error('provision failed');
            },
          };
          const create = b.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
          await reached(pb);
          const search = a.createSearchIndex({ indexName: coll, searchIndexName: 'A' }).catch(e => e);
          // The search call has read the entry before the vector index exists or is recorded as owned.
          await reached(pa);
          expect((await entry(coll))?.ownsVectorIndex).toBeUndefined();
          pb.release.resolve();
          await create;
          expect((await entry(coll))?.ownsVectorIndex).toBe(true);
          pa.release.resolve();
          // The concurrent ownership write rotates the claimToken, so the search call's compare-and-set misses.
          expect((await search).id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect((await entry(coll))?.ownsVectorIndex).toBe(true);
          (a as any).testHooks = undefined;
          await a.deleteIndex({ indexName: coll });
          expect(await settledNames(db, coll, [])).toEqual([]);
        });

        it('I-2: a failed createSearchIndex never undoes a claim that completed while it ran', async () => {
          const coll = uniqueName('clm');
          colls.push(coll);
          await seedCollection(db, coll, [{ title: 'a' }]);
          await seedRegistry(db, {
            _id: coll,
            indexName: coll,
            collectionName: coll,
            searchIndexName: `${coll}_vector_index`,
            isByo: false,
            allowWrites: true,
            claimToken: 't0',
          });
          const pa = pause();
          (a as any).testHooks = {
            afterCreateSearchIndexRead: pa.hook,
            beforeSearchIndexProvision: async () => {
              throw new Error('provision failed');
            },
          };
          const search = a.createSearchIndex({ indexName: coll, searchIndexName: 'A' }).catch(e => e);
          await reached(pa);
          await b.claimLegacyIndex({ indexName: coll });
          expect((await entry(coll))?.ownsCollection).toBe(true);
          pa.release.resolve();
          // The claim sets a fresh claimToken, so the search call's compare-and-set misses.
          expect((await search).id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(await entry(coll)).toMatchObject({ ownsCollection: true, ownsVectorIndex: true });
        });

        it('M-2: a registration on a collection a managed delete is dropping refuses with INDEX_DELETING', async () => {
          const coll = uniqueName('mdel');
          colls.push(coll);
          await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
          await seedRegistry(db, {
            _id: coll,
            indexName: coll,
            collectionName: coll,
            searchIndexName: `${coll}_vector_index`,
            isByo: false,
            allowWrites: true,
            ownsCollection: true,
            ownsVectorIndex: true,
            deleting: true,
            deleteToken: 't',
          });
          const err = await b
            .createIndex({ indexName: `${coll}_Y`, dimension: 4, collectionName: coll, searchIndexName: 'yv' })
            .catch(e => e);
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
          expect(await entry(`${coll}_Y`)).toBeNull();
          expect(await settledNames(db, coll, [])).toEqual([]);
        });

        // Another call retargets the registration between this call's write and its pre-provision
        // check. Provisioning the old target then would leave a Mastra-created search index that no
        // registration records, so deleteIndex could never clean it up.
        describe('target changed before the pre-provision check', () => {
          const pauses: ReturnType<typeof pause>[] = [];
          const held = () => {
            const p = pause();
            pauses.push(p);
            return p;
          };
          afterEach(() => {
            for (const p of pauses.splice(0)) p.release.resolve();
          });
          const seeded = async (prefix: string) => {
            const coll = uniqueName(prefix);
            colls.push(coll);
            await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
            return coll;
          };

          it('P-R1: a createIndex whose vector index name another call changed refuses with CONFLICT and creates nothing', async () => {
            const coll = await seeded('r1');
            const p = held();
            (a as any).testHooks = { beforePendingDropCheck: p.hook };
            const first = a
              .createIndex({ indexName: coll, dimension: 4, collectionName: coll, searchIndexName: 'V1' })
              .catch(e => e);
            await reached(p);
            // Nothing was registered before a started, so the generation to keep is the one a's write created.
            const generation = (await entry(coll))?.generation;
            expect(typeof generation).toBe('string');
            await b.createIndex({ indexName: coll, dimension: 4, collectionName: coll, searchIndexName: 'V2' });
            const afterB = await entry(coll);
            expect(afterB?.generation).toBe(generation);
            p.release.resolve();
            const err = await first;
            expect(await settledNames(db, coll, ['V2'])).toEqual(['V2']);
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err.category).toBe('USER');
            expect(err.message).toMatch(/searchIndexName "V2" instead of "V1"/);
            expect(await entry(coll)).toMatchObject({
              searchIndexName: 'V2',
              ownsVectorIndex: true,
              generation: afterB?.generation,
            });
          });

          it('P-R2: a refresh whose registration was deleted and recreated on another collection refuses with CONFLICT', async () => {
            const coll = await byo();
            const other = await seeded('r2y');
            const p = held();
            (a as any).testHooks = { beforePendingDropCheck: p.hook };
            const refresh = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
            await reached(p);
            await b.deleteIndex({ indexName: coll });
            await b.createIndex({ indexName: coll, dimension: 4, collectionName: other });
            const afterB = await entry(coll);
            expect(typeof afterB?.generation).toBe('string');
            p.release.resolve();
            const err = await refresh;
            expect(await settledNames(db, coll, [])).toEqual([]);
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err.message).toMatch(new RegExp(`collectionName "${other}" instead of "${coll}"`));
            expect(await entry(coll)).toMatchObject({
              collectionName: other,
              ownsVectorIndex: true,
              generation: afterB?.generation,
            });
          });

          it('P-R3: a createSearchIndex whose text index another call renamed refuses with CONFLICT and creates nothing', async () => {
            const coll = await byo();
            const generation = (await entry(coll))?.generation;
            expect(typeof generation).toBe('string');
            const p = held();
            (a as any).testHooks = { beforePendingDropCheck: p.hook };
            const first = a.createSearchIndex({ indexName: coll, searchIndexName: 'N1' }).catch(e => e);
            await reached(p);
            await b.createSearchIndex({ indexName: coll, searchIndexName: 'N2' });
            const afterB = await entry(coll);
            expect(afterB?.generation).toBe(generation);
            p.release.resolve();
            const err = await first;
            expect((await searchIndexNames(db, coll)).sort()).toEqual(['N2', `${coll}_vector_index`]);
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
            expect(err.message).toMatch(/textSearchIndexName "N2" instead of "N1"/);
            const e = await entry(coll);
            expect(e).toMatchObject({ textSearchIndexName: 'N2', ownsTextIndex: true, generation: afterB?.generation });
            expect(e?.retiredTextIndexNames ?? []).toEqual([]);
          });

          it('a managed createIndex whose companion text index was renamed refuses with CONFLICT and creates neither index', async () => {
            const coll = uniqueName('cmp');
            colls.push(coll);
            const p = held();
            (a as any).testHooks = { beforePendingDropCheck: p.hook };
            const create = a.createIndex({ indexName: coll, dimension: 4 }).catch(e => e);
            await reached(p);
            await b.createSearchIndex({ indexName: coll, searchIndexName: 'T2' });
            p.release.resolve();
            const err = await create;
            expect(await settledNames(db, coll, ['T2'])).toEqual(['T2']);
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err.message).toMatch(new RegExp(`textSearchIndexName "T2" instead of "${coll}_search_index"`));
            expect(await entry(coll)).toMatchObject({ textSearchIndexName: 'T2', ownsTextIndex: true });
          });

          // A partial legacy entry has no collectionName; reads default it to the managed collection,
          // and so must the pre-provision check, or the call could never succeed.
          it('a createSearchIndex on a legacy entry with no recorded collection provisions without CONFLICT', async () => {
            const coll = await seeded('px');
            await seedRegistry(db, { _id: coll, indexName: coll, textSearchIndexName: `${coll}_search_index` });
            try {
              await a.createSearchIndex({ indexName: coll });
              expect(await settledNames(db, coll, [`${coll}_search_index`])).toEqual([`${coll}_search_index`]);
              expect(await entry(coll)).toMatchObject({ textSearchIndexName: `${coll}_search_index` });
            } finally {
              await db.collection(REGISTRY).deleteOne({ _id: coll as any });
            }
          });

          // A delete followed by an identical recreate leaves the same target under a new generation,
          // so the stale refresh's check refuses instead of provisioning for a registration it never wrote.
          it('P-SAME-pre: a refresh paused before its check, racing a delete and an identical recreate, refuses with CONFLICT and the recreate owns its index', async () => {
            const coll = await byo();
            const pa = held();
            const pb = held();
            (a as any).testHooks = { beforePendingDropCheck: pa.hook };
            const refresh = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
            await reached(pa);
            await b.deleteIndex({ indexName: coll });
            expect(await settledNames(db, coll, [])).toEqual([]);
            (b as any).testHooks = { beforePendingDropCheck: pb.hook };
            const recreate = b.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
            await reached(pb);
            pa.release.resolve();
            const err = await refresh;
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err.message).toMatch(/removed or recreated by another call/);
            pb.release.resolve();
            await recreate;
            const e = await entry(coll);
            expect(e?.ownsVectorIndex).toBe(true);
            (b as any).testHooks = undefined;
            await b.deleteIndex({ indexName: coll });
            expect(await settledNames(db, coll, [])).toEqual([]);
          });
        });
      });

      it('T18: a managed createSearchIndex still provisions the dynamic default index', async () => {
        const coll = uniqueName('mgd');
        colls.push(coll);
        await a.createIndex({ indexName: coll, dimension: 4 });
        await a.createSearchIndex({ indexName: coll, fields: ['title'] });
        expect(await searchIndexNames(db, coll)).toContain(`${coll}_search_index`);
      });
    });
  });

  describe('claimLegacyIndex', () => {
    const dyn = { mappings: { dynamic: true } };
    const vec = { fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }] };
    const names: string[] = [];
    const pauses: { release: { resolve: () => void } }[] = [];
    let other: MongoDBVector;

    beforeAll(async () => {
      other = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'claim-other' });
      await other.connect();
    });

    afterAll(async () => {
      await other.disconnect();
    });

    afterEach(async () => {
      for (const p of pauses.splice(0)) p.release.resolve();
      (store as any).testHooks = undefined;
      (other as any).testHooks = undefined;
      for (const n of names.splice(0)) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: n as any }, { collectionName: n }] });
        await dropCollectionWithSearchIndexes(db, n).catch(() => {});
      }
    });

    const errId = (code: string) => createVectorErrorId('MONGODB', 'CLAIM_LEGACY_INDEX', code);
    const reg = (id: string) => db.collection(REGISTRY).findOne({ _id: id as any });
    const exists = (c: string) => db.listCollections({ name: c }).hasNext();

    /** A collection created by Mastra before 1.15: physical indexes, no registry entry. */
    async function legacy(withText = false) {
      const X = uniqueName('claim');
      names.push(X);
      await seedCollection(db, X, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      await createRawSearchIndex(db, X, `${X}_vector_index`, vec);
      if (withText) await createRawSearchIndex(db, X, `${X}_search_index`, dyn, 'search');
      await waitFor(async () => {
        const n = await searchIndexNames(db, X);
        return n.includes(`${X}_vector_index`) && (!withText || n.includes(`${X}_search_index`));
      });
      return X;
    }

    /** A managed registration written by 1.15–1.27 (no ownership flags), seeded directly. */
    async function flagless(extra: Document = {}) {
      const X = uniqueName('claim');
      names.push(X);
      await seedCollection(db, X, [{ title: 'a' }]);
      const entry = {
        _id: X,
        indexName: X,
        collectionName: X,
        searchIndexName: `${X}_vector_index`,
        isByo: false,
        allowWrites: true,
        ...extra,
      };
      await seedRegistry(db, entry);
      return { X, entry };
    }

    /** Parks `on` at the named test hook (by default the claim, right after its first registry read). */
    function holdAfterRead(on: MongoDBVector = store, hook = 'afterClaimRead') {
      const reached = deferred();
      const release = deferred();
      pauses.push({ release });
      (on as any).testHooks = {
        [hook]: async () => {
          reached.resolve();
          await release.promise;
        },
      };
      return { reached, release };
    }

    /** Makes every search-index listing after the claim's registry write throw. */
    /** Makes every search-index listing after the claim's registry write throw; `state.written` says the write happened. */
    function failRelistAfterWrite() {
      const state = { written: false, failed: false };
      (store as any).testHooks = {
        afterClaimWrite: async () => {
          state.written = true;
        },
        listSearchIndexesStub: () => {
          if (!state.written) return undefined;
          state.failed = true;
          throw new Error('listing failed');
        },
      };
      return state;
    }

    // PR #30067 review: a claim whose verification failed left ownsCollection: true behind.
    it('T5c: a registered claim whose re-list fails leaves the entry unclaimed', async () => {
      const { X } = await flagless();
      const state = failRelistAfterWrite();
      await expect(store.claimLegacyIndex({ indexName: X })).rejects.toThrow(/listing failed/);
      expect(state).toEqual({ written: true, failed: true });
      expect((await reg(X))?.ownsCollection).toBeUndefined();
    });

    it('T5d: an inserted claim whose re-list fails leaves no registration', async () => {
      const X = await legacy();
      const state = failRelistAfterWrite();
      await expect(store.claimLegacyIndex({ indexName: X })).rejects.toThrow(/listing failed/);
      expect(state).toEqual({ written: true, failed: true });
      expect(await reg(X)).toBeNull();
    });

    // Independent review of PR #30067: the registry read after a successful re-list was outside the undo.
    it('T5e: a registered claim whose verification read fails leaves the entry unclaimed, so deleteIndex keeps the data', async () => {
      const { X } = await flagless();
      const read = (store as any).readRegistryEntry.bind(store);
      let written = false;
      let failed = false;
      (store as any).testHooks = {
        afterClaimWrite: async () => {
          written = true;
        },
      };
      const spy = vi.spyOn(store as any, 'readRegistryEntry').mockImplementation(async (...args: any[]) => {
        if (written && !failed) {
          failed = true;
          throw new Error('verification read failed');
        }
        return read(...args);
      });
      try {
        await expect(store.claimLegacyIndex({ indexName: X })).rejects.toThrow(/verification read failed/);
      } finally {
        spy.mockRestore();
        (store as any).testHooks = undefined;
      }
      expect(failed).toBe(true);
      expect((await reg(X))?.ownsCollection).toBeUndefined();
      const err = await store.deleteIndex({ indexName: X }).catch(e => e);
      expect(err?.id).toBe(createVectorErrorId('MONGODB', 'DELETE_INDEX', 'OWNERSHIP_UNKNOWN'));
      expect(await exists(X)).toBe(true);
    });

    // Independent review of PR #30067: an undo that a later write makes miss used to be silent.
    it('T5f: a failed claim whose registration changed meanwhile keeps that write and logs a warning', async () => {
      const { X } = await flagless();
      const logs = captureLogs(store);
      const read = (store as any).readRegistryEntry.bind(store);
      let written = false;
      let failed = false;
      (store as any).testHooks = {
        afterClaimWrite: async () => {
          written = true;
          // Another writer's mutation: a new token and rev, as every registry write makes.
          await db
            .collection(REGISTRY)
            .updateOne({ _id: X as any }, { $set: { claimToken: 'other' }, $inc: { rev: 1 } });
        },
      };
      const spy = vi.spyOn(store as any, 'readRegistryEntry').mockImplementation(async (...args: any[]) => {
        if (written && !failed) {
          failed = true;
          throw new Error('verification read failed');
        }
        return read(...args);
      });
      try {
        await expect(store.claimLegacyIndex({ indexName: X })).rejects.toThrow(/verification read failed/);
      } finally {
        spy.mockRestore();
        (store as any).testHooks = undefined;
      }
      expect(await reg(X)).toMatchObject({ claimToken: 'other', ownsCollection: true });
      expect(logs.warn.some(m => m.includes('the claim was not undone'))).toBe(true);
    });

    it('T5b: a claimed pre-1.15 collection is dropped by deleteIndex', async () => {
      const X = await legacy();
      await store.claimLegacyIndex({ indexName: X });
      await store.deleteIndex({ indexName: X });
      expect(await exists(X)).toBe(false);
      expect(await store.listIndexes()).not.toContain(X);
    });

    it('T6: a pre-1.15 collection adopted by createIndex is dropped after a claim', async () => {
      const X = await legacy();
      await store.createIndex({ indexName: X, dimension: 4 });
      expect((await reg(X))?.ownsCollection).toBe(false);
      await store.claimLegacyIndex({ indexName: X });
      await store.deleteIndex({ indexName: X });
      expect(await exists(X)).toBe(false);
    });

    it('T7: a flagless registration can update its text mapping only after a claim', async () => {
      const { X } = await flagless();
      await db
        .collection(REGISTRY)
        .updateOne({ _id: X as any }, { $set: { textSearchIndexName: `${X}_search_index` } });
      await createRawSearchIndex(db, X, `${X}_search_index`, dyn, 'search');
      await waitFor(async () => (await searchIndexNames(db, X)).includes(`${X}_search_index`));
      const params = { indexName: X, fields: ['title'], searchIndexName: `${X}_search_index` };
      const err = await store.createSearchIndex(params).catch(e => e);
      expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
      expect(err.message).toMatch(/claimLegacyIndex/);
      await store.claimLegacyIndex({ indexName: X });
      await store.createSearchIndex(params);
      await waitFor(async () => {
        const [idx] = await db.collection(X).listSearchIndexes(`${X}_search_index`).toArray();
        return idx?.latestDefinition?.mappings?.dynamic === false && !!idx.latestDefinition.mappings.fields?.title;
      });
    });

    it('T8: a claimed pre-1.15 text index is recorded as owned and its mapping can be updated', async () => {
      const X = await legacy(true);
      await store.claimLegacyIndex({ indexName: X });
      expect(await reg(X)).toMatchObject({ textSearchIndexName: `${X}_search_index`, ownsTextIndex: true });
      await store.createSearchIndex({ indexName: X, fields: ['title'], searchIndexName: `${X}_search_index` });
    });

    it('T9: an explicit ownsTextIndex: false survives a claim', async () => {
      const { X } = await flagless({ textSearchIndexName: 'shared_fts', ownsTextIndex: false });
      await store.claimLegacyIndex({ indexName: X });
      expect(await reg(X)).toMatchObject({ ownsCollection: true, ownsVectorIndex: true, ownsTextIndex: false });
    });

    it('a claim that read an entry without a generation does not claim a replacement registered meanwhile', async () => {
      const X = uniqueName('claim');
      names.push(X);
      await seedCollection(db, X, [{ title: 'a' }]);
      // Adopted an existing collection (ownsCollection: false), as a pre-generation instance left it.
      await other.createIndex({ indexName: X, dimension: 4 });
      await db.collection(REGISTRY).updateOne({ _id: X as any }, { $unset: { generation: '' } });
      const hold = holdAfterRead();
      const claim = store.claimLegacyIndex({ indexName: X }).catch(e => e);
      await hold.reached.promise;
      await other.deleteIndex({ indexName: X });
      // Atlas Local can briefly list the dropped indexes as DELETING, a retryable CONFLICT.
      const stuck = createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT');
      await waitFor(() =>
        other.createIndex({ indexName: X, dimension: 4 }).then(
          () => true,
          e => (e?.id === stuck ? false : Promise.reject(e)),
        ),
      );
      const replacement = await reg(X);
      expect(replacement?.ownsCollection).toBe(false);
      hold.release.resolve();
      const err = await claim;
      expect(err?.id).toBe(errId('CONFLICT'));
      expect(await reg(X)).toEqual(replacement);
    });

    describe('T10: refusals and idempotence', () => {
      it('a BYO entry refuses with BYO and is unchanged', async () => {
        const { X, entry } = await flagless({ isByo: true, allowWrites: false });
        const err = await store.claimLegacyIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('BYO'));
        expect(err.category).toBe('USER');
        expect(await reg(X)).toEqual(entry);
      });

      it('an unknown name refuses with NOT_FOUND', async () => {
        const X = uniqueName('claim');
        names.push(X);
        const err = await store.claimLegacyIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('NOT_FOUND'));
        expect(err.category).toBe('USER');
        expect(await reg(X)).toBeNull();
      });

      it('a collection used by a BYO entry refuses with IN_USE and writes nothing', async () => {
        const X = await legacy();
        await seedRegistry(db, {
          _id: `${X}_byo`,
          indexName: `${X}_byo`,
          collectionName: X,
          searchIndexName: `${X}_byo_vec`,
          isByo: true,
          allowWrites: false,
        });
        const err = await store.claimLegacyIndex({ indexName: X }).catch(e => e);
        expect(err.id).toBe(errId('IN_USE'));
        expect(err.category).toBe('USER');
        expect(await reg(X)).toBeNull();
      });

      it('claiming twice resolves', async () => {
        const X = await legacy();
        await store.claimLegacyIndex({ indexName: X });
        const first = await reg(X);
        await store.claimLegacyIndex({ indexName: X });
        // Only the concurrency fields move (rev, and the claim's fresh claimToken); every recorded field stays the same.
        expect({ ...(await reg(X)), rev: 0, claimToken: '' }).toEqual({ ...first, rev: 0, claimToken: '' });
      });
    });

    describe('T11: races', () => {
      it('two concurrent claims both resolve and one entry exists', async () => {
        const X = await legacy();
        await Promise.all([store.claimLegacyIndex({ indexName: X }), other.claimLegacyIndex({ indexName: X })]);
        expect(await db.collection(REGISTRY).countDocuments({ _id: X as any })).toBe(1);
        expect(await reg(X)).toMatchObject({ ownsCollection: true, ownsVectorIndex: true });
      });

      it('a claim racing a BYO createIndex keeps the BYO entry and refuses', async () => {
        const X = await legacy();
        const p = holdAfterRead();
        const claim = store.claimLegacyIndex({ indexName: X }).catch(e => e);
        await p.reached.promise;
        await other.createIndex({ indexName: X, collectionName: X, dimension: 4 });
        const byo = await reg(X);
        p.release.resolve();
        const err = await claim;
        expect([errId('BYO'), errId('CONFLICT')]).toContain(err.id);
        expect(await reg(X)).toEqual(byo);
        expect(byo?.isByo).toBe(true);
      });

      it('an entry retargeted between the read and the claim refuses with CONFLICT', async () => {
        const { X } = await flagless();
        const p = holdAfterRead();
        const claim = store.claimLegacyIndex({ indexName: X }).catch(e => e);
        await p.reached.promise;
        await db.collection(REGISTRY).updateOne({ _id: X as any }, { $set: { collectionName: `${X}_moved` } });
        const moved = await reg(X);
        p.release.resolve();
        const err = await claim;
        expect(err.id).toBe(errId('CONFLICT'));
        expect(err.category).toBe('USER');
        expect(await reg(X)).toEqual(moved);
      });

      for (const byo of [false, true]) {
        it(`a createIndex that read no entry refreshes a same-target claim made since and keeps it claimed (${byo ? 'BYO' : 'managed'})`, async () => {
          const X = await legacy();
          const p = holdAfterRead(other, 'afterCreateIndexRead');
          const create = other.createIndex({ indexName: X, dimension: 4, ...(byo ? { collectionName: X } : {}) });
          await p.reached.promise;
          await store.claimLegacyIndex({ indexName: X });
          p.release.resolve();
          await create;
          expect(await db.collection(REGISTRY).countDocuments({ _id: X as any })).toBe(1);
          expect(await reg(X)).toMatchObject({ isByo: false, ownsCollection: true, ownsVectorIndex: true });
          expect(await db.collection(X).countDocuments()).toBe(1);
          expect(await searchIndexNames(db, X)).toContain(`${X}_vector_index`);
        });
      }

      it('a createIndex for another collection refuses with CONFLICT naming the difference, and the claim stays', async () => {
        const X = await legacy();
        const Y = `${X}_byo_coll`;
        names.push(Y);
        await seedCollection(db, Y, [{ embedding: [1, 0, 0, 0] }]);
        const p = holdAfterRead(other, 'afterCreateIndexRead');
        const create = other.createIndex({ indexName: X, dimension: 4, collectionName: Y }).catch(e => e);
        await p.reached.promise;
        await store.claimLegacyIndex({ indexName: X });
        const claimed = await reg(X);
        p.release.resolve();
        const err = await create;
        expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err.message).toContain(`collection "${X}" instead of "${Y}"`);
        expect(err.message).not.toMatch(/deleteIndex/);
        expect(await reg(X)).toEqual(claimed);
        expect(claimed).toMatchObject({ isByo: false, ownsCollection: true });
      });

      for (const by of ['BYO createIndex', 'claimLegacyIndex'] as const) {
        it(`a createSearchIndex that read no entry refuses with CONFLICT when a ${by} registers it meanwhile`, async () => {
          const X = await legacy();
          const p = holdAfterRead(other, 'afterCreateSearchIndexRead');
          const create = other.createSearchIndex({ indexName: X }).catch(e => e);
          await p.reached.promise;
          if (by === 'claimLegacyIndex') await store.claimLegacyIndex({ indexName: X });
          else await store.createIndex({ indexName: X, collectionName: X, dimension: 4 });
          const registered = await reg(X);
          p.release.resolve();
          const err = await create;
          expect(err.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
          expect(err.category).toBe('USER');
          expect(err.message).toMatch(/registered by another call/);
          expect(await reg(X)).toEqual(registered);
          expect(await searchIndexNames(db, X)).not.toContain(`${X}_search_index`);
        });
      }

      it('two racing identical createIndex calls both resolve with one registration', async () => {
        const X = uniqueName('claim');
        names.push(X);
        const p = holdAfterRead(other, 'afterCreateIndexRead');
        const late = other.createIndex({ indexName: X, dimension: 4 });
        await p.reached.promise;
        await store.createIndex({ indexName: X, dimension: 4 });
        p.release.resolve();
        await late;
        expect(await db.collection(REGISTRY).countDocuments({ _id: X as any })).toBe(1);
        expect(await reg(X)).toMatchObject({ isByo: false, ownsCollection: true });
      });

      it('a registration that starts using the collection during the insert rolls the claim back with IN_USE', async () => {
        const X = await legacy();
        const p = holdAfterRead(store, 'beforeClaimInsert');
        const claim = store.claimLegacyIndex({ indexName: X }).catch(e => e);
        await p.reached.promise;
        await seedRegistry(db, {
          _id: `${X}_byo`,
          indexName: `${X}_byo`,
          collectionName: X,
          searchIndexName: `${X}_byo_vec`,
          isByo: true,
          allowWrites: false,
        });
        p.release.resolve();
        const err = await claim;
        expect(err.id).toBe(errId('IN_USE'));
        expect(await reg(X)).toBeNull();
        expect(await reg(`${X}_byo`)).not.toBeNull();
      });

      it('T11a: a competing managed registration on another collection wins and stays unchanged', async () => {
        const X = await legacy();
        const p = holdAfterRead();
        const claim = store.claimLegacyIndex({ indexName: X }).catch(e => e);
        await p.reached.promise;
        const winner = {
          _id: X,
          indexName: X,
          collectionName: `${X}_other`,
          searchIndexName: `${X}_vector_index`,
          isByo: false,
          allowWrites: true,
          ownsCollection: true,
        };
        await seedRegistry(db, winner);
        p.release.resolve();
        const err = await claim;
        expect(err.id).toBe(errId('CONFLICT'));
        expect(await reg(X)).toEqual(winner);
      });
    });

    it('RF4: a deleting entry refuses with INDEX_DELETING and is unchanged', async () => {
      const { X, entry } = await flagless({ deleting: true, deleteToken: 't' });
      const err = await store.claimLegacyIndex({ indexName: X }).catch(e => e);
      expect(err.id).toBe(errId('INDEX_DELETING'));
      expect(err.message).toMatch(/deleteIndex/);
      expect(await reg(X)).toEqual(entry);
    });
  });
});
