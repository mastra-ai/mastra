import { createVectorErrorId } from '@mastra/core/storage';
import { MongoClient, MongoNetworkError, MongoServerError, ObjectId } from 'mongodb';
import type { CommandStartedEvent, Db, Document, MongoClientOptions } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  JOURNAL,
  REGISTRY,
  captureCommands,
  captureLogs,
  clusterCreateMode,
  createRawSearchIndex,
  deferred,
  listedId,
  pause,
  rawClient,
  reached,
  searchIndexNames,
  seedCollection,
  seedRegistry,
  uniqueName,
  unknownCreateMode,
  waitFor,
  dropCollectionWithSearchIndexes,
  hooks,
  installInvariantChecker,
  recordDrops,
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

type Checker = ReturnType<typeof installInvariantChecker>;
type CleanOpts = Parameters<Checker['assertClean']>[1];

/**
 * Run the invariant checker after every test of the enclosing describe, on the collections the
 * test added to `colls`. A test states what it leaves unrecorded in the returned `clean.opts`.
 */
function checkEachTest(colls: string[], checker: () => Checker) {
  const clean: { opts: CleanOpts } = { opts: {} };
  let first = 0;
  beforeEach(() => {
    first = colls.length;
    clean.opts = {};
  });
  afterEach(async () => {
    checker().restoreHooks();
    await checker().assertClean(colls.slice(first), clean.opts);
  });
  return clean;
}

const SEARCH_INDEX_COMMANDS = ['createSearchIndexes', 'dropSearchIndex', 'updateSearchIndex'];
const READS = ['find', 'aggregate', 'count', 'distinct'];
const WRITES = ['insert', 'update', 'delete', 'findAndModify'];

/** Under the fixture's directConnection=true the driver sends a requested `primary` as `primaryPreferred`. */
const ok = (c: Document) =>
  c.$readPreference === undefined || ['primary', 'primaryPreferred'].includes(c.$readPreference.mode);
const isListing = (e: CommandStartedEvent) =>
  e.commandName === 'aggregate' && e.command.pipeline?.[0]?.$listSearchIndexes !== undefined;
const touchesMastra = (e: CommandStartedEvent) =>
  typeof e.command[e.commandName] === 'string' && e.command[e.commandName].startsWith('__mastra_vector_');

/** Group the commands sent inside transactions by session and transaction number. */
function transactionsOf(events: CommandStartedEvent[]) {
  const groups = new Map<string, CommandStartedEvent[]>();
  for (const e of events) {
    if (e.command.autocommit !== false) continue;
    const key = `${e.command.lsid.id.toString('hex')}:${e.command.txnNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].map(g => ({ first: g[0]!, commit: g.find(e => e.commandName === 'commitTransaction') }));
}

describe('provisioning protocol', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = await rawClient();
    db = client.db(DB_NAME);
  });

  afterAll(async () => {
    await client.close();
  });

  describe.each<[string, MongoClientOptions]>([
    ['readConcern local', { readConcern: { level: 'local' } }],
    ['readConcernLevel majority', { readConcernLevel: 'majority' }],
  ])('P-SECPREF (%s)', (_label, readOptions) => {
    it('pins registry, transaction, search-index and listing commands to the primary with the I7a concerns', async () => {
      const store = new MongoDBVector({
        uri: ATLAS_LOCAL_URI,
        dbName: DB_NAME,
        id: 'p-secpref',
        options: { readPreference: 'secondaryPreferred', monitorCommands: true, ...readOptions },
      });
      await store.connect();
      const checker = installInvariantChecker(db, [store]);
      const byo = uniqueName('secpref_byo');
      const legacy = uniqueName('secpref_legacy');
      try {
        await seedCollection(db, byo, [{ embedding: [1, 0, 0, 0], note: 'a' }]);
        await seedCollection(db, legacy);
        await createRawSearchIndex(db, legacy, `${legacy}_vector_index`, {
          fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
        });

        const events = captureCommands(store);
        const indexName = `${byo}_idx`;
        await store.createIndex({ indexName, dimension: 4, collectionName: byo });
        const afterCreate = events.length;
        await store.createSearchIndex({ indexName, searchIndexName: 'N1' });
        await store.createSearchIndex({ indexName, searchIndexName: 'N2' });
        await store.claimLegacyIndex({ indexName: legacy });
        const beforeDelete = events.length;
        await store.deleteIndex({ indexName });
        const afterDelete = events.length;
        await store.deleteIndex({ indexName: legacy });

        // The existence checks createIndex and deleteIndex base ownership decisions on read the primary.
        // createIndex's is its first listCollections; deleteIndex's collection handle is cached by then.
        const strictPrimary = (e?: CommandStartedEvent) =>
          ['primary', 'primaryPreferred'].includes(e?.command.$readPreference?.mode);
        const createChecks = events.slice(0, afterCreate).filter(e => e.commandName === 'listCollections');
        const deleteChecks = events.slice(beforeDelete, afterDelete).filter(e => e.commandName === 'listCollections');
        expect(deleteChecks.length).toBeGreaterThan(0);
        for (const e of [createChecks[0], ...deleteChecks]) expect(strictPrimary(e)).toBe(true);

        const registryAndJournal = events.filter(touchesMastra);
        expect(registryAndJournal.length).toBeGreaterThan(0);
        for (const e of registryAndJournal) {
          expect(ok(e.command), `${e.commandName} ${JSON.stringify(e.command.$readPreference)}`).toBe(true);
          if (e.command.autocommit !== undefined) continue;
          if (READS.includes(e.commandName)) expect(e.command.readConcern).toEqual({ level: 'majority' });
          if (WRITES.includes(e.commandName)) expect(e.command.writeConcern).toMatchObject({ w: 'majority' });
        }

        const transactions = transactionsOf(events);
        expect(transactions.length).toBeGreaterThan(0);
        for (const t of transactions) {
          expect(t.first.command.readConcern).toMatchObject({ level: 'majority' });
          expect(t.commit?.command.writeConcern).toMatchObject({ w: 'majority' });
        }

        const searchIndexCommands = events.filter(e => SEARCH_INDEX_COMMANDS.includes(e.commandName));
        for (const e of searchIndexCommands) {
          expect(ok(e.command)).toBe(true);
          expect(e.command.readConcern).toBeUndefined();
          expect(e.command.writeConcern).toBeUndefined();
        }

        const listings = events.filter(isListing);
        for (const e of listings) {
          expect(ok(e.command)).toBe(true);
          expect(e.command.readConcern).toEqual({ level: 'local' });
          expect(e.command.txnNumber).toBeUndefined();
          expect(e.command.autocommit).toBeUndefined();
        }
        expect(searchIndexCommands.length).toBeGreaterThan(0);
        expect(listings.length).toBeGreaterThan(0);
        await checker.assertClean([byo, legacy]);
      } finally {
        await store.disconnect();
        await dropCollectionWithSearchIndexes(db, byo).catch(() => {});
        await dropCollectionWithSearchIndexes(db, legacy).catch(() => {});
      }
    });
  });

  describe('generation', () => {
    let a: MongoDBVector;
    let b: MongoDBVector;
    let checker: Checker;
    const colls: string[] = [];
    const entry = (name: string) => db.collection(REGISTRY).findOne({ _id: name as any });

    beforeAll(async () => {
      a = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'gen-a' });
      b = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'gen-b' });
      await a.connect();
      await b.connect();
      checker = installInvariantChecker(db, [a, b]);
    });
    const clean = checkEachTest(colls, () => checker);

    afterAll(async () => {
      for (const c of colls) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
        await db.collection(JOURNAL).deleteMany({ collectionName: c });
        await dropCollectionWithSearchIndexes(db, c).catch(() => {});
      }
      await a.disconnect();
      await b.disconnect();
    });

    async function byoColl(prefix: string) {
      const coll = uniqueName(prefix);
      colls.push(coll);
      await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      return coll;
    }

    it('P-BACKFILL-gen: concurrent refreshes of a legacy entry backfill one stable generation', async () => {
      const coll = await byoColl('pbf');
      await seedRegistry(db, {
        _id: coll,
        indexName: coll,
        collectionName: coll,
        searchIndexName: `${coll}_vector_index`,
        isByo: true,
        allowWrites: false,
        dimension: 4,
        metric: 'cosine',
      });
      const refresh = (s: MongoDBVector) => s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
      await Promise.all([refresh(a), refresh(b), refresh(a), refresh(b), refresh(a)]);
      // Sequenced after the refreshes: run concurrently, its compare-and-set would lose to them by design.
      await a.createSearchIndex({ indexName: coll, searchIndexName: 'N' });
      const e = await entry(coll);
      expect(typeof e?.generation).toBe('string');
      expect(e?.rev).toBeGreaterThanOrEqual(6);
      expect(e?.ownsTextIndex).toBe(true);
      await refresh(b);
      expect((await entry(coll))?.generation).toBe(e?.generation);
    });

    it('P-ID-pre: identical concurrent BYO createIndex calls all succeed and record ownership on one generation', async () => {
      const coll = await byoColl('pid');
      const all = deferred();
      let arrived = 0;
      const hook = async () => {
        if (++arrived === 5) all.resolve();
        await all.promise;
      };
      hooks(a, { beforePendingDropCheck: hook });
      hooks(b, { beforePendingDropCheck: hook });
      try {
        const create = (s: MongoDBVector) => s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        await Promise.all([create(a), create(b), create(a), create(b), create(a)]);
      } finally {
        checker.restoreHooks();
      }
      const docs = await db
        .collection(REGISTRY)
        .find({ _id: coll as any })
        .toArray();
      expect(docs).toHaveLength(1);
      expect(typeof docs[0]?.generation).toBe('string');
      expect(docs[0]?.ownsVectorIndex).toBe(true);
      expect(await searchIndexNames(db, coll)).toEqual([`${coll}_vector_index`]);
    });

    it('P-MIXED: an old-code delete and recreate during provisioning refuses with the generation CONFLICT', async () => {
      const coll = await byoColl('pmix');
      const p = pause();
      hooks(a, { beforePendingDropCheck: p.hook });
      try {
        const create = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
        await reached(p);
        const written = await entry(coll);
        // What an old instance's delete and identical recreate leave: same target, no generation, no rev.
        await db.collection(REGISTRY).deleteOne({ _id: coll as any });
        const oldShaped = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: written?.searchIndexName,
          isByo: true,
          allowWrites: false,
          dimension: 4,
          metric: 'cosine',
        };
        await seedRegistry(db, oldShaped);
        p.release.resolve();
        const err = await create;
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(
          `Index "${coll}" was removed or recreated by another call while this one ran, so nothing was provisioned. Retry.`,
        );
        expect(await searchIndexNames(db, coll)).toEqual([]);
        // The rollback is pinned on this call's generation, so the old instance's entry is untouched.
        expect(await entry(coll)).toEqual(oldShaped);
      } finally {
        p.release.resolve();
        checker.restoreHooks();
      }
    });

    describe('P-ROLLBACK', () => {
      /**
       * a's rename to B fails after its P0 write; just before, `concurrent` writes to the entry.
       * Returns the entry right after that write, the entry after a's failure, and the sampled revs.
       */
      async function failRenameAfter(coll: string, concurrent: () => Promise<unknown>) {
        const revs: number[] = [];
        const sample = async () => {
          const e = await entry(coll);
          revs.push(e?.rev ?? 0);
          return e;
        };
        let afterWrite: Document | null = null;
        await sample();
        hooks(a, {
          beforeSearchIndexProvision: async () => {
            await sample();
            await concurrent();
            afterWrite = await sample();
            throw new Error('provision failed');
          },
        });
        try {
          await expect(a.createSearchIndex({ indexName: coll, searchIndexName: 'B' })).rejects.toThrow(
            'provision failed',
          );
        } finally {
          checker.restoreHooks();
        }
        const after = await sample();
        for (let i = 1; i < revs.length; i++) expect(revs[i]).toBeGreaterThanOrEqual(revs[i - 1]!);
        return { afterWrite: afterWrite as Document | null, after };
      }

      it('(i) a refresh after P0 survives the rollback', async () => {
        const coll = await byoColl('prb1');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        await a.createSearchIndex({ indexName: coll, searchIndexName: 'A' });
        const { afterWrite, after } = await failRenameAfter(coll, () =>
          b.createSearchIndex({ indexName: coll, searchIndexName: 'B' }),
        );
        expect(afterWrite).toMatchObject({ textSearchIndexName: 'B', ownsTextIndex: true });
        expect(after).toEqual(afterWrite);
      });

      it('(ii) a createIndex refresh and its P7 survive the rollback', async () => {
        const coll = await byoColl('prb2');
        // A legacy BYO entry whose vector index does not exist yet, so b's refresh creates it and records it (P7).
        await seedRegistry(db, {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: `${coll}_vector_index`,
          isByo: true,
          allowWrites: false,
          dimension: 4,
          metric: 'cosine',
        });
        const { afterWrite, after } = await failRenameAfter(coll, () =>
          b.createIndex({ indexName: coll, dimension: 4, collectionName: coll }),
        );
        expect(afterWrite).toMatchObject({ ownsVectorIndex: true, textSearchIndexName: 'B' });
        expect(after).toEqual(afterWrite);
      });

      it('(iii) a rollback with no concurrent write restores the written fields and keeps a backfilled generation', async () => {
        const coll = await byoColl('prb3');
        const legacy = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: `${coll}_vector_index`,
          isByo: true,
          allowWrites: false,
          dimension: 4,
          metric: 'cosine',
        };
        await seedRegistry(db, legacy);
        const { afterWrite, after } = await failRenameAfter(coll, async () => {});
        expect(typeof afterWrite?.generation).toBe('string');
        expect(after).toEqual({ ...legacy, generation: afterWrite?.generation, rev: 2, claimToken: after?.claimToken });
        expect(after?.claimToken).not.toBe(afterWrite?.claimToken);
      });

      /**
       * a's createIndex parks right after reading the entry, `between` runs, then a's P0 writes and
       * its pre-provision check fails, so a rolls back. Returns a's error.
       */
      async function failAfterInterleavedWrite(coll: string, params: Document, between: () => Promise<unknown>) {
        const p = pause();
        hooks(a, {
          afterCreateIndexRead: p.hook,
          beforePendingDropCheck: async () => {
            throw new Error('provision failed');
          },
        });
        try {
          const call = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll, ...params }).catch(e => e);
          await reached(p);
          await between();
          p.release.resolve();
          return await call;
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
      }

      it('(iv) a refresh and its P7 landing between the read and P0 survive the rollback', async () => {
        const coll = await byoColl('prb4');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll, searchIndexName: 'V0' });
        let afterB: Document | null = null;
        const err = await failAfterInterleavedWrite(coll, { searchIndexName: 'V1' }, async () => {
          await b.createIndex({ indexName: coll, dimension: 4, collectionName: coll, searchIndexName: 'V1' });
          afterB = await entry(coll);
        });
        expect(err?.message).toMatch(/provision failed/);
        expect(afterB).toMatchObject({ searchIndexName: 'V1', ownsVectorIndex: true });
        const after = await entry(coll);
        // a's P0 and its rollback each bump rev; the rollback restores what P0 overwrote: b's write.
        expect(after).toEqual({ ...afterB!, rev: afterB!.rev + 2, claimToken: after?.claimToken });
        expect(after?.claimToken).not.toBe(afterB!.claimToken);
      });

      it('(v) an old-code entry written between the read and P0 is restored, not deleted', async () => {
        const coll = await byoColl('prb5');
        const legacy = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: `${coll}_vector_index`,
          isByo: true,
          allowWrites: false,
          dimension: 4,
          metric: 'cosine',
        };
        const err = await failAfterInterleavedWrite(coll, {}, () => seedRegistry(db, legacy));
        expect(err?.message).toMatch(/provision failed/);
        const after = await entry(coll);
        expect(typeof after?.generation).toBe('string');
        expect(after).toEqual({ ...legacy, generation: after?.generation, rev: 2, claimToken: after?.claimToken });
      });

      it('(vi) an entry P0 re-inserted after a delete is removed by the rollback', async () => {
        const coll = await byoColl('prb6');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        const err = await failAfterInterleavedWrite(coll, {}, () => b.deleteIndex({ indexName: coll }));
        expect(err?.message).toMatch(/provision failed/);
        expect(await entry(coll)).toBeNull();
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('(vii) a refresh-time TOFU write after P0 moves the pin, so the rollback still undoes P0 and keeps the id', async () => {
        const coll = await byoColl('prb7');
        const vec = `${coll}_vector_index`;
        await createRawSearchIndex(db, coll, vec, {
          fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
        });
        const v = await listedId(db, coll, vec);
        // A legacy entry owning its listed vector index, with no recorded id.
        const legacy = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: vec,
          isByo: true,
          allowWrites: false,
          ownsVectorIndex: true,
        };
        await seedRegistry(db, legacy);
        hooks(a, {
          beforePendingDropCheck: async () => {
            throw new Error('provision failed');
          },
        });
        const err = await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
        checker.restoreHooks();
        expect(err?.message).toMatch(/provision failed/);
        const after = await entry(coll);
        // P0, the TOFU write and the rollback each bump rev. P0's fields (dimension, metric) are undone;
        // the TOFU id is proof for a name the entry already owned, so it stays.
        expect(after).toEqual({
          ...legacy,
          indexIds: [{ name: vec, id: v }],
          generation: after?.generation,
          rev: 3,
          claimToken: after?.claimToken,
        });
      });
    });

    // The seam sends the real create, so a live row exists, then reports `error` instead of the reply.
    async function createWithRefusal(error: MongoServerError) {
      const coll = await byoColl('refuse');
      hooks(a, {
        createSearchIndexesCommand: async (_cmd: Document, run: () => Promise<Document>) => {
          await run();
          throw error;
        },
      });
      try {
        const result = await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
        return { coll, result };
      } finally {
        checker.restoreHooks();
      }
    }

    it('attaches, without recording ownership, when Atlas Local refuses a racing identical create', async () => {
      const { coll, result } = await createWithRefusal(
        new MongoServerError({
          code: 2,
          codeName: 'BadValue',
          errmsg: 'duplicate index names for the same collection: x',
        }),
      );
      expect(result).toBeUndefined();
      expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
      expect(await searchIndexNames(db, coll)).toEqual([`${coll}_vector_index`]);
      // The seam's real create stands in for the winning racer's; nothing records it here.
      clean.opts = { expectedLeaks: [`${coll}_vector_index`] };
    });

    it('attaches as uncertain, never owning, when a create errors in a way its own create may have landed', async () => {
      const logs = captureLogs(a);
      const { coll, result } = await createWithRefusal(
        new MongoServerError({ code: 50, codeName: 'MaxTimeMSExpired', errmsg: 'operation exceeded time limit' }),
      );
      // `unknown` + a listed row is uncertain (I9): attached and logged, not owned.
      expect(result).toBeUndefined();
      expect(logs.warn.some(m => m.includes('may have been created by Mastra'))).toBe(true);
      expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
      // The uncertain journal record holds it.
      expect(await db.collection(JOURNAL).findOne({ collectionName: coll })).toMatchObject({ state: 'uncertain' });
      clean.opts = { journalExpected: true };
    });
  });
  describe('provisioning with ids (S2)', () => {
    let a: MongoDBVector;
    let b: MongoDBVector;
    let checker: Checker;
    const colls: string[] = [];
    const entry = (name: string) => db.collection(REGISTRY).findOne({ _id: name as any });
    const idOf = (e: Document | null, name: string) =>
      e?.indexIds?.find((x: { name: string }) => x.name === name)?.id as string | undefined;
    const vectorDefinition = {
      fields: [
        { type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' },
        { type: 'filter', path: '_id' },
        { type: 'filter', path: 'document' },
      ],
    };

    beforeAll(async () => {
      a = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'ids-a', options: { monitorCommands: true } });
      b = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'ids-b' });
      await a.connect();
      await b.connect();
      checker = installInvariantChecker(db, [a, b]);
    });
    const clean = checkEachTest(colls, () => checker);

    afterAll(async () => {
      for (const c of colls) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
        await db.collection(JOURNAL).deleteMany({ collectionName: c });
        await dropCollectionWithSearchIndexes(db, c).catch(() => {});
      }
      await a.disconnect();
      await b.disconnect();
    });

    async function byoColl(prefix: string) {
      const coll = uniqueName(prefix);
      colls.push(coll);
      await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      return coll;
    }

    /** Run `fn` with `extra` merged into the hooks of `stores`, then back to the checker's alone. */
    async function withHooks<T>(stores: MongoDBVector[], extra: Document, fn: () => Promise<T>): Promise<T> {
      for (const s of stores) hooks(s, extra);
      try {
        return await fn();
      } finally {
        checker.restoreHooks();
      }
    }

    const createByo = (s: MongoDBVector, coll: string, extra: Document = {}) =>
      s.createIndex({ indexName: coll, dimension: 4, collectionName: coll, ...extra });

    describe.each<[string, boolean]>([
      ['local', false],
      ['cluster', true],
    ])('P-ID (%s)', (_label, cluster) => {
      it('identical concurrent calls released in any order all succeed and record the listed id', async () => {
        const coll = await byoColl('pid');
        const gates = Array.from({ length: 5 }, () => deferred());
        const all = deferred();
        let arrived = 0;
        const beforeAtlasCreate = async () => {
          const gate = gates[arrived]!;
          if (++arrived === 5) all.resolve();
          await gate.promise;
        };
        const hooks = { beforeAtlasCreate, ...(cluster ? { createSearchIndexesCommand: clusterCreateMode(db) } : {}) };
        await withHooks([a, b], hooks, async () => {
          const calls = [a, b, a, b, a].map(s => createByo(s, coll));
          try {
            // Bounded: fails after 15 s if a call never reaches the create.
            await reached({ reached: all });
            // A different release order on each run.
            for (const i of [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)) {
              gates[i]!.resolve();
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5)));
            }
          } finally {
            for (const g of gates) g.resolve();
            // Settle every call even when the barrier failed, so none rejects unhandled.
            const settled = await Promise.allSettled(calls);
            for (const r of settled) if (r.status === 'rejected') throw r.reason;
          }
        });
        const docs = await db
          .collection(REGISTRY)
          .find({ _id: coll as any })
          .toArray();
        expect(docs).toHaveLength(1);
        expect(typeof docs[0]?.generation).toBe('string');
        expect(docs[0]?.ownsVectorIndex).toBe(true);
        const vec = `${coll}_vector_index`;
        expect(docs[0]?.indexIds).toEqual([{ name: vec, id: await listedId(db, coll, vec) }]);
      });
    });

    it('P-NOROW: a successful create the P5 listing does not show is proven and recorded', async () => {
      const coll = await byoColl('pnorow');
      const vec = `${coll}_vector_index`;
      await withHooks(
        [a],
        { listSearchIndexesStub: (_n: string, phase: string) => (phase === 'P5' ? [] : undefined) },
        () => createByo(a, coll),
      );
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds?.[0]?.id).toBe(await listedId(db, coll, vec));
    });

    it('P-X8: an external identical create between P3a and P4 on the cluster is recorded as ours', async () => {
      const coll = await byoColl('px8');
      const vec = `${coll}_vector_index`;
      await withHooks(
        [a],
        {
          createSearchIndexesCommand: clusterCreateMode(db),
          beforeAtlasCreate: () => createRawSearchIndex(db, coll, vec, vectorDefinition),
        },
        () => createByo(a, coll),
      );
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds?.[0]?.id).toBe(await listedId(db, coll, vec));
    });

    it('P-X8-OLD: an existing identical index answering with its old id is foreign by timestamp', async () => {
      const coll = await byoColl('px8old');
      const vec = `${coll}_vector_index`;
      await createRawSearchIndex(db, coll, vec, vectorDefinition);
      const OLD = ObjectId.createFromTime(Math.floor(Date.now() / 1000) - 60).toHexString();
      const logs = captureLogs(a);
      await withHooks(
        [a],
        {
          listSearchIndexesStub: (name: string, phase: string) =>
            phase === 'P1' || phase === 'P3a' ? [] : phase === 'P5' ? [{ name, id: OLD, status: 'READY' }] : undefined,
          createSearchIndexesCommand: async () => ({ ok: 1, indexesCreated: [{ id: OLD, name: vec }] }),
        },
        () => createByo(a, coll),
      );
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).not.toBe(true);
      expect(e?.indexIds ?? []).toEqual([]);
      expect(logs.warn.some(m => m.includes(vec) && m.includes(OLD))).toBe(true);
      clean.opts = { userIndexes: [vec] };
    });

    it('P-PARTIAL: a failed companion text create keeps the proven vector index owned', async () => {
      const managed = uniqueName('ppartial');
      colls.push(managed);
      const refuse = async (cmd: Document, run: () => Promise<Document>) => {
        if (cmd.indexes[0].type === 'search') {
          throw new MongoServerError({ code: 2, codeName: 'BadValue', errmsg: 'injected' });
        }
        return run();
      };
      const result = await withHooks([a], { createSearchIndexesCommand: refuse }, () =>
        a.createIndex({ indexName: managed, dimension: 4 }).catch(e => e),
      );
      expect(result).toBeInstanceOf(Error);
      const vec = `${managed}_vector_index`;
      const e = await entry(managed);
      expect(e).not.toBeNull();
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds).toEqual([{ name: vec, id: await listedId(db, managed, vec) }]);
      expect(await searchIndexNames(db, managed)).toEqual([vec]);
    });

    it('P4-TIMEOUT: every createSearchIndexes carries a deadline of at most 60 s', async () => {
      const managed = uniqueName('ptimeout');
      colls.push(managed);
      const events = captureCommands(a);
      await a.createIndex({ indexName: managed, dimension: 4 });
      const creates = events.filter(e => e.commandName === 'createSearchIndexes');
      expect(creates).toHaveLength(2);
      for (const c of creates) {
        expect(c.command.maxTimeMS).toBeGreaterThan(0);
        expect(c.command.maxTimeMS).toBeLessThanOrEqual(60_000);
      }
    });

    it('P-STUCKROW: a dying row at the decisive pre-list refuses with CONFLICT and rolls back', async () => {
      const coll = await byoColl('pstuck');
      const vec = `${coll}_vector_index`;
      const err = await withHooks(
        [a],
        {
          listSearchIndexesStub: (name: string, phase: string) =>
            phase === 'P3a' ? [{ name, id: 'x', status: 'DELETING' }] : undefined,
        },
        () => createByo(a, coll).catch(e => e),
      );
      expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
      expect(err?.message).toBe(
        `search index "${vec}" on "${coll}" is in status DELETING (id x); the previous index under this name is still being removed. Retry. If it persists, drop it manually.`,
      );
      expect(await entry(coll)).toBeNull();
    });

    it('RF-P5ERR: a failing P5 listing after a successful create counts as no row: proven, no rollback', async () => {
      const coll = await byoColl('rfp5');
      const vec = `${coll}_vector_index`;
      await withHooks(
        [a],
        {
          listSearchIndexesStub: (_n: string, phase: string) => {
            if (phase === 'P5') throw new MongoNetworkError('blip');
            return undefined;
          },
        },
        () => createByo(a, coll),
      );
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds?.[0]?.id).toBe(await listedId(db, coll, vec));
    });

    it('RF-NAMES: an index name containing a dot is recorded by id', async () => {
      const coll = await byoColl('rfnames');
      await createByo(a, coll, { searchIndexName: 'v.1' });
      expect((await entry(coll))?.indexIds).toEqual([{ name: 'v.1', id: await listedId(db, coll, 'v.1') }]);
    });

    describe('vector rename (§3.3)', () => {
      it('P-VRENAME: a replaced vector index stays retired and is dropped by deleteIndex', async () => {
        const coll = await byoColl('pvrename');
        await createByo(a, coll, { searchIndexName: 'V0' });
        const v0 = await listedId(db, coll, 'V0');
        await createByo(a, coll, { searchIndexName: 'V1' });
        const before = await entry(coll);
        expect(before?.retiredVectorIndexNames).toEqual(['V0']);
        expect(before?.ownsVectorIndex).toBe(true);
        expect(before?.indexIds).toContainEqual({ name: 'V0', id: v0 });
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-ABA-seq: renaming back reactivates the retired name, owned', async () => {
        const coll = await byoColl('pabaseq');
        await createByo(a, coll, { searchIndexName: 'A' });
        await createByo(a, coll, { searchIndexName: 'B' });
        await createByo(a, coll, { searchIndexName: 'A' });
        const after = await entry(coll);
        expect(after?.ownsVectorIndex).toBe(true);
        expect(after?.searchIndexName).toBe('A');
        expect(after?.retiredVectorIndexNames).toEqual(['B']);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-XROLE: a vector name that was a retired text index is refused, and the reverse', async () => {
        const coll = await byoColl('pxrole');
        await createByo(a, coll, { searchIndexName: 'V' });
        await a.createSearchIndex({ indexName: coll, searchIndexName: 'T' });
        await a.createSearchIndex({ indexName: coll, searchIndexName: 'T2' });
        const before = await entry(coll);
        expect(before?.retiredTextIndexNames).toEqual(['T']);
        await expect(createByo(a, coll, { searchIndexName: 'T' })).rejects.toMatchObject({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          message: `searchIndexName "T" was a full-text search index of index "${coll}"; choose a different name.`,
        });
        expect(await entry(coll)).toEqual(before);

        await createByo(a, coll, { searchIndexName: 'V2' });
        const renamed = await entry(coll);
        expect(renamed?.retiredVectorIndexNames).toEqual(['V']);
        await expect(a.createSearchIndex({ indexName: coll, searchIndexName: 'V' })).rejects.toMatchObject({
          id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
          message: `searchIndexName "V" was a vector search index of index "${coll}"; choose a different name.`,
        });
        expect(await entry(coll)).toEqual(renamed);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      /** a's createIndex(params) parks right after its read while `between` runs, then completes. */
      async function interleaveAfterRead(coll: string, name: string, between: () => Promise<unknown>) {
        const p = pause();
        hooks(a, { afterCreateIndexRead: p.hook });
        try {
          const call = createByo(a, coll, { searchIndexName: name }).catch(e => e);
          await reached(p);
          await between();
          p.release.resolve();
          expect(await call).toBeUndefined();
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
      }

      it('P-VRENAME-race (i): a concurrent identical rename landing before P0 keeps its ownership', async () => {
        const coll = await byoColl('pvrace1');
        await createByo(a, coll, { searchIndexName: 'V0' });
        await interleaveAfterRead(coll, 'V1', () => createByo(b, coll, { searchIndexName: 'V1' }));
        const after = await entry(coll);
        expect(after?.searchIndexName).toBe('V1');
        expect(after?.ownsVectorIndex).toBe(true);
        expect(after?.retiredVectorIndexNames).toEqual(['V0']);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-VRENAME-race (ii): a P0 retargeting from a concurrent owned name never owns its own target', async () => {
        const coll = await byoColl('pvrace2');
        await createRawSearchIndex(db, coll, 'A', vectorDefinition);
        await waitFor(async () => (await listedId(db, coll, 'A')) !== undefined);
        await createByo(a, coll, { searchIndexName: 'A' });
        expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
        await interleaveAfterRead(coll, 'A', () => createByo(b, coll, { searchIndexName: 'B' }));
        const after = await entry(coll);
        expect(after?.searchIndexName).toBe('A');
        expect(after?.ownsVectorIndex).toBe(false);
        expect(after?.retiredVectorIndexNames).toEqual(['B']);
        const bId = idOf(after, 'B');
        expect(bId).toBeDefined();
        const { drops } = recordDrops(a);
        await a.deleteIndex({ indexName: coll });
        expect(drops).toEqual([{ collectionName: coll, name: 'B', id: bId }]);
        expect(await searchIndexNames(db, coll)).toEqual(['A']);
        clean.opts = { userIndexes: ['A'] };
      });
    });

    describe('I11 in delete', () => {
      const STALE = '000000000000000000000000';
      const textDefinition = { mappings: { dynamic: true } };
      /** Seed a BYO registration `<coll>_<key>` on `coll`. */
      const seedUser = (coll: string, key: string, extra: Document) =>
        seedRegistry(db, {
          _id: `${coll}_${key}`,
          indexName: `${coll}_${key}`,
          collectionName: coll,
          searchIndexName: `${coll}_${key}_vec`,
          isByo: true,
          allowWrites: false,
          ownsVectorIndex: false,
          ...extra,
        });

      it('P-STALEID-T1: a sibling owning under a stale id blocks the drop and its id is rewritten to the listed one', async () => {
        const coll = await byoColl('staleid_t1');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        const id = await listedId(db, coll, 'A');
        expect(id).toBeDefined();
        await seedUser(coll, 'x', { textSearchIndexName: 'A', ownsTextIndex: true, indexIds: [{ name: 'A', id }] });
        await seedUser(coll, 'y', {
          textSearchIndexName: 'A',
          ownsTextIndex: true,
          indexIds: [{ name: 'A', id: STALE }],
        });
        await seedUser(coll, 'z', { textSearchIndexName: 'A', indexIds: [{ name: 'A', id: STALE }] });

        await a.deleteIndex({ indexName: `${coll}_x` });

        expect(await listedId(db, coll, 'A')).toBe(id);
        expect(await entry(`${coll}_x`)).toBeNull();
        const y = await entry(`${coll}_y`);
        expect(y?.ownsTextIndex).toBe(true);
        expect(y?.indexIds).toEqual([{ name: 'A', id }]);
        const z = await entry(`${coll}_z`);
        expect(z?.ownsTextIndex).toBeUndefined();
        expect(z?.indexIds).toEqual([{ name: 'A', id: STALE }]);
      });

      it('P-STALEID-T1b: a replaced incarnation is never transferred, and the stranger survives both deletes', async () => {
        const coll = await byoColl('staleid_t1b');
        await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
        const r = await listedId(db, coll, 'N');
        expect(r).toBeDefined();
        await seedUser(coll, 'a', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: r }] });
        await seedUser(coll, 'b', { textSearchIndexName: 'N' });
        // An external drop of R, then an external create of X under the same name.
        await db.command({ dropSearchIndex: coll, id: r }, { readPreference: 'primary' });
        await waitFor(async () => (await listedId(db, coll, 'N')) === undefined);
        await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
        const x = await listedId(db, coll, 'N');
        expect(x).toBeDefined();
        expect(x).not.toBe(r);

        await a.deleteIndex({ indexName: `${coll}_a` });
        expect((await entry(`${coll}_b`))?.ownsTextIndex).not.toBe(true);
        await a.deleteIndex({ indexName: `${coll}_b` });

        expect(await listedId(db, coll, 'N')).toBe(x);
        clean.opts = { userIndexes: ['N'] };
      });

      it('INV: the checker reports an unrecorded index and a drop of a referenced name', async () => {
        const coll = await byoColl('inv');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        await expect(checker.assertClean([coll])).rejects.toThrow(/search index "A" .* is held by no record/);
        await seedUser(coll, 'x', { textSearchIndexName: 'A' });
        await (a as any).dropSearchIndexById(coll, 'A', await listedId(db, coll, 'A'));
        expect(checker.violations).toHaveLength(1);
        checker.violations.length = 0;
      });

      it('P-DEL-ID: a delete drops the incarnation it recorded, never a stranger recreated under the name', async () => {
        const coll = await byoColl('pdelid');
        await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
        const r = await listedId(db, coll, 'N');
        await seedUser(coll, 'a', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: r }] });
        const { drops } = recordDrops(a);
        const p = pause();
        hooks(a, { beforeDeleteDrop: p.hook });
        const del = a.deleteIndex({ indexName: `${coll}_a` }).catch(e => e);
        try {
          await reached(p);
          // An external drop of R, then an external create of X under the same name.
          await db.command({ dropSearchIndex: coll, id: r }, { readPreference: 'primary' });
          await waitFor(async () => (await listedId(db, coll, 'N')) === undefined);
          await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
        } finally {
          p.release.resolve();
        }
        expect(await del).toBeUndefined();
        const x = await listedId(db, coll, 'N');
        expect(x).toBeDefined();
        expect(x).not.toBe(r);
        expect(drops).toEqual([{ collectionName: coll, name: 'N', id: r }]);
        expect(await entry(`${coll}_a`)).toBeNull();
        clean.opts = { userIndexes: ['N'] };
      });

      it('P-DEL-RESUME-VRETIRED: a resumed delete drops a retired vector name by its recorded id', async () => {
        const coll = await byoColl('pdelrv');
        await createRawSearchIndex(db, coll, 'R', vectorDefinition);
        await waitFor(async () => (await listedId(db, coll, 'R')) !== undefined);
        const r = await listedId(db, coll, 'R');
        await seedUser(coll, 'a', {
          retiredVectorIndexNames: ['R'],
          indexIds: [{ name: 'R', id: r }],
          deleting: true,
          deleteToken: 'resumed',
        });
        const { drops } = recordDrops(a);
        await a.deleteIndex({ indexName: `${coll}_a` });
        expect(drops).toEqual([{ collectionName: coll, name: 'R', id: r }]);
        expect(await entry(`${coll}_a`)).toBeNull();
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-BACKFILL-ids: refreshes record a legacy name its listed id once; an unrefreshed one is dropped by the id listed then', async () => {
        const coll = await byoColl('pbfid');
        await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
        await createRawSearchIndex(db, coll, 'M', textDefinition, 'search');
        const n = await listedId(db, coll, 'N');
        const m = await listedId(db, coll, 'M');
        // Legacy entries: owned text names, no generation, no indexIds.
        await seedUser(coll, 'x', { textSearchIndexName: 'N', ownsTextIndex: true });
        await seedUser(coll, 'y', { textSearchIndexName: 'M', ownsTextIndex: true });
        const results = await Promise.allSettled(
          [a, b].map(s => s.createSearchIndex({ indexName: `${coll}_x`, searchIndexName: 'N' })),
        );
        // Same-name refreshes compare-and-set on the entry they read: a loser refuses with a retryable CONFLICT.
        expect(results.some(r => r.status === 'fulfilled')).toBe(true);
        for (const r of results)
          if (r.status === 'rejected')
            expect(r.reason?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
        expect((await entry(`${coll}_x`))?.indexIds).toEqual([{ name: 'N', id: n }]);

        const { drops } = recordDrops(a);
        await a.deleteIndex({ indexName: `${coll}_y` });
        expect(drops).toEqual([{ collectionName: coll, name: 'M', id: m }]);
        expect(await listedId(db, coll, 'N')).toBe(n);

        // Two createIndex refreshes, both past P0 and both about to record the listed vector id.
        const vec = `${coll}_z_vector_index`;
        await createRawSearchIndex(db, coll, vec, vectorDefinition);
        const v = await listedId(db, coll, vec);
        await seedUser(coll, 'z', { searchIndexName: vec, ownsVectorIndex: true });
        const both = deferred();
        let arrived = 0;
        const beforeTofuWrite = async () => {
          if (++arrived === 2) both.resolve();
          await reached({ reached: both });
        };
        await withHooks([a, b], { beforeTofuWrite }, () =>
          Promise.all([a, b].map(s => s.createIndex({ indexName: `${coll}_z`, dimension: 4, collectionName: coll }))),
        );
        expect(arrived).toBe(2);
        const z = await entry(`${coll}_z`);
        expect(z?.indexIds).toEqual([{ name: vec, id: v }]);
        // Two P0 writes and exactly one TOFU write: the racer whose P0 was superseded records nothing.
        expect(z?.rev).toBe(3);
      });

      it('R7a: without transactions, a recipient that stops using the name makes the delete refuse instead of orphaning it', async () => {
        const coll = await byoColl('r7a');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        const r = await listedId(db, coll, 'A');
        await seedUser(coll, 'x', { textSearchIndexName: 'A', ownsTextIndex: true, indexIds: [{ name: 'A', id: r }] });
        await seedUser(coll, 'y', { textSearchIndexName: 'A' });
        const err = await withHooks(
          [a],
          {
            probeTransactions: async () => false,
            // The recipient moves to another name between the delete's read and its transfer.
            insideDeleteTransaction: async () => {
              await db
                .collection(REGISTRY)
                .updateOne({ _id: `${coll}_y` as any }, { $set: { textSearchIndexName: 'B' } });
            },
          },
          () => a.deleteIndex({ indexName: `${coll}_x` }).catch(e => e),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'DELETE_INDEX', 'CONFLICT'));
        const x = await entry(`${coll}_x`);
        expect(x).toMatchObject({ ownsTextIndex: true, indexIds: [{ name: 'A', id: r }] });
        expect(x?.deleting).toBeUndefined();
        // The retry finds no user any more and drops A by its recorded id.
        await a.deleteIndex({ indexName: `${coll}_x` });
        await waitFor(async () => (await listedId(db, coll, 'A')) === undefined);
      });

      it('R7b: a dying row at the delete pre-list confirms nothing, so the name is not handed over', async () => {
        const coll = await byoColl('r7b');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        const r = await listedId(db, coll, 'A');
        await seedUser(coll, 'x', { textSearchIndexName: 'A', ownsTextIndex: true, indexIds: [{ name: 'A', id: r }] });
        await seedUser(coll, 'y', { textSearchIndexName: 'A' });
        await withHooks(
          [a],
          {
            listSearchIndexesStub: (name: string, phase: string) =>
              phase === 'delete' ? [{ name, id: r, status: 'DELETING' }] : undefined,
          },
          () => a.deleteIndex({ indexName: `${coll}_x` }),
        );
        expect(await entry(`${coll}_x`)).toBeNull();
        const y = await entry(`${coll}_y`);
        expect(y?.ownsTextIndex).not.toBe(true);
        expect(y?.indexIds).toBeUndefined();
        expect(await listedId(db, coll, 'A')).toBe(r);
        // Kept and logged: neither dropped nor handed over.
        clean.opts = { expectedLeaks: ['A'] };
      });

      it('R7c: an id rewrite misses an entry that is deleting or no longer owns the name', async () => {
        const coll = await byoColl('r7c');
        const deleting = { textSearchIndexName: 'A', ownsTextIndex: true, deleting: true };
        await seedUser(coll, 'd', { ...deleting, indexIds: [{ name: 'A', id: STALE }] });
        await seedUser(coll, 'u', { textSearchIndexName: 'A', indexIds: [{ name: 'A', id: STALE }] });
        for (const key of ['d', 'u']) {
          const toId = `${coll}_${key}`;
          const before = await entry(toId);
          const plan = {
            drop: [],
            transfers: [],
            released: [],
            kept: [],
            rewrites: [{ toId, name: 'A', id: '1'.repeat(24) }],
          };
          expect(await (a as any).applyCleanupWrites('other', coll, plan)).toBe(false);
          expect(await entry(toId)).toEqual(before);
        }
      });
    });
  });

  describe('journal (S3)', () => {
    let a: MongoDBVector;
    let b: MongoDBVector;
    let checker: Checker;
    const colls: string[] = [];
    const entry = (name: string) => db.collection(REGISTRY).findOne({ _id: name as any });
    const docsOn = (coll: string) => db.collection(JOURNAL).find({ collectionName: coll }).toArray();
    const uncertainText = (name: string, coll: string, id: string) =>
      `search index "${name}" on "${coll}" (id ${id}) may have been created by Mastra; kept; drop it manually if unused`;

    beforeAll(async () => {
      a = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'j-a', options: { monitorCommands: true } });
      b = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'j-b' });
      await a.connect();
      await b.connect();
      checker = installInvariantChecker(db, [a, b]);
    });
    const clean = checkEachTest(colls, () => checker);

    afterAll(async () => {
      for (const c of colls) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
        await db.collection(JOURNAL).deleteMany({ collectionName: c });
        await dropCollectionWithSearchIndexes(db, c).catch(() => {});
      }
      await a.disconnect();
      await b.disconnect();
    });

    async function byoColl(prefix: string) {
      const coll = uniqueName(prefix);
      colls.push(coll);
      await seedCollection(db, coll, [{ title: 'a', embedding: [1, 0, 0, 0] }]);
      return coll;
    }
    const createByo = (s: MongoDBVector, coll: string) =>
      s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
    const reconcile = (s: MongoDBVector, coll: string): Promise<void> => (s as any).reconcile(coll);

    /** A crash: a throwaway store parks forever in `seam` (lease 0), then its client is closed. */
    async function crashAt(coll: string, seam: string) {
      const c = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'j-crash' });
      await c.connect();
      const p = pause();
      hooks(c, { leaseMs: 0, [seam]: p.hook });
      void createByo(c, coll).catch(() => {});
      await reached(p);
      await c.disconnect();
    }

    it('P-LOST-a: a lost response with the index listed records it uncertain; deleteIndex keeps it and removes the record', async () => {
      const coll = await byoColl('plosta');
      const vec = `${coll}_vector_index`;
      const logs = captureLogs(a);
      hooks(a, { createSearchIndexesCommand: unknownCreateMode({ perform: true }) });
      await createByo(a, coll);
      checker.restoreHooks();
      const id = await listedId(db, coll, vec);
      expect(id).toBeDefined();
      const [doc] = await docsOn(coll);
      expect(doc).toMatchObject({ state: 'uncertain', candidateId: id, name: vec });
      expect(logs.warn).toContain(uncertainText(vec, coll, id!));
      expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
      logs.warn.length = 0;
      await a.deleteIndex({ indexName: coll });
      expect(await searchIndexNames(db, coll)).toEqual([vec]);
      expect(await docsOn(coll)).toEqual([]);
      expect(logs.warn).toContain(uncertainText(vec, coll, id!));
      clean.opts = { expectedLeaks: [vec] };
    });

    it('P-LOST-b: a lost response with nothing listed fails, stays creating, and the reconciler removes it', async () => {
      const coll = await byoColl('plostb');
      const vec = `${coll}_vector_index`;
      hooks(a, { leaseMs: 0, createSearchIndexesCommand: unknownCreateMode({ perform: false }) });
      const err = await createByo(a, coll).catch(e => e);
      checker.restoreHooks();
      expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'FAILED'));
      expect(err?.message).toBe(
        `The create of search index "${vec}" on "${coll}" may or may not have reached Atlas. Retry.`,
      );
      expect(await docsOn(coll)).toMatchObject([{ state: 'creating', preListAbsent: true }]);
      expect(await entry(coll)).not.toBeNull();
      await reconcile(b, coll);
      expect(await docsOn(coll)).toEqual([]);
      expect(await searchIndexNames(db, coll)).toEqual([]);
    });

    it('P-LOST-c: a create landing late after a lost response makes the reconciler record it uncertain', async () => {
      const coll = await byoColl('plostc');
      const vec = `${coll}_vector_index`;
      const logs = captureLogs(b);
      hooks(a, { leaseMs: 0, createSearchIndexesCommand: unknownCreateMode({ perform: false }) });
      await createByo(a, coll).catch(() => {});
      checker.restoreHooks();
      await createRawSearchIndex(db, coll, vec, {
        fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
      });
      const id = (await listedId(db, coll, vec))!;
      await reconcile(b, coll);
      expect(await docsOn(coll)).toMatchObject([{ state: 'uncertain', candidateId: id }]);
      expect(logs.warn).toContain(uncertainText(vec, coll, id));
      clean.opts = { journalExpected: true };
    });

    it('P-FENCE-1: an intent the reconciler removed fails its fence: no create, rolled back', async () => {
      const coll = await byoColl('pfence1');
      const p = pause();
      hooks(a, { leaseMs: 0, beforeAtlasCreate: p.hook });
      const events = captureCommands(a);
      const call = createByo(a, coll).catch(e => e);
      try {
        await reached(p);
        expect(await docsOn(coll)).toMatchObject([{ state: 'intent' }]);
        await reconcile(b, coll);
        expect(await docsOn(coll)).toEqual([]);
      } finally {
        p.release.resolve();
      }
      const err = await call;
      checker.restoreHooks();
      expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
      expect(err?.message).toBe(
        `Index "${coll}" was removed or recreated by another call while this one ran, so nothing was provisioned. Retry.`,
      );
      expect(events.filter(e => e.commandName === 'createSearchIndexes')).toEqual([]);
      expect(await entry(coll)).toBeNull();
      expect(await searchIndexNames(db, coll)).toEqual([]);
    });

    it('P-FENCE-2: a crash after the create leaves creating, which the reconciler records uncertain', async () => {
      const coll = await byoColl('pfence2');
      const vec = `${coll}_vector_index`;
      const logs = captureLogs(b);
      await crashAt(coll, 'afterAtlasCreate');
      const id = (await listedId(db, coll, vec))!;
      expect(id).toBeDefined();
      expect(await docsOn(coll)).toMatchObject([{ state: 'creating' }]);
      await reconcile(b, coll);
      expect(await docsOn(coll)).toMatchObject([{ state: 'uncertain', candidateId: id }]);
      expect(logs.warn).toContain(uncertainText(vec, coll, id));
      clean.opts = { journalExpected: true };
    });

    it('P-FENCE-3: a proof after the reconciler removed the creating doc restores it and records ownership', async () => {
      const coll = await byoColl('pfence3');
      const vec = `${coll}_vector_index`;
      const p = pause();
      hooks(a, { leaseMs: 0, beforeProof: p.hook });
      hooks(b, { listSearchIndexesStub: (_n: string, phase: string) => (phase === 'reconciler' ? [] : undefined) });
      const call = createByo(a, coll);
      try {
        await reached(p);
        await reconcile(b, coll);
        expect(await docsOn(coll)).toEqual([]);
      } finally {
        p.release.resolve();
      }
      await call;
      checker.restoreHooks();
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds).toEqual([{ name: vec, id: await listedId(db, coll, vec) }]);
      expect(await docsOn(coll)).toEqual([]);
    });

    it('P-CRASH-a: a crash before the P3 check is resolved, and a later refresh owns the index', async () => {
      const coll = await byoColl('pcrasha');
      await crashAt(coll, 'beforePendingDropCheck');
      await createByo(b, coll);
      expect(await docsOn(coll)).toEqual([]);
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds).toEqual([
        { name: `${coll}_vector_index`, id: await listedId(db, coll, `${coll}_vector_index`) },
      ]);
    });

    it('P-CRASH-b: a crash at intent is removed by the reconciler, idempotently', async () => {
      const coll = await byoColl('pcrashb');
      await crashAt(coll, 'afterProvisionIntent');
      expect(await docsOn(coll)).toMatchObject([{ state: 'intent' }]);
      await reconcile(b, coll);
      await reconcile(b, coll);
      expect(await docsOn(coll)).toEqual([]);
      expect(await searchIndexNames(db, coll)).toEqual([]);
    });

    it('P-CRASH-c: a crash in creating before the create is removed by the reconciler, idempotently', async () => {
      const coll = await byoColl('pcrashc');
      await crashAt(coll, 'createSearchIndexesCommand');
      expect(await docsOn(coll)).toMatchObject([{ state: 'creating' }]);
      await reconcile(b, coll);
      await reconcile(b, coll);
      expect(await docsOn(coll)).toEqual([]);
      expect(await searchIndexNames(db, coll)).toEqual([]);
    });

    it('RF-STANDALONE: provisioning on a standalone server fails, rolls back and leaves no journal doc', async () => {
      const uri = 'mongodb://localhost:27017';
      const dbName = uniqueName('standalone');
      const s = new MongoDBVector({ uri, dbName, id: 'j-standalone' });
      await s.connect();
      const raw = await new MongoClient(uri).connect();
      try {
        const name = uniqueName('rfstd');
        await expect(s.createIndex({ indexName: name, dimension: 4 })).rejects.toThrow();
        const sdb = raw.db(dbName);
        expect(await sdb.collection(REGISTRY).findOne({ _id: name as any })).toBeNull();
        expect(await sdb.collection(JOURNAL).findOne({ indexName: name })).toBeNull();
      } finally {
        await raw
          .db(dbName)
          .dropDatabase()
          .catch(() => {});
        await raw.close();
        await s.disconnect();
      }
    });
  });
});
