import { createVectorErrorId } from '@mastra/core/storage';
import { MongoClient, MongoNetworkError, MongoServerError, ObjectId } from 'mongodb';
import type { CommandStartedEvent, Db, Document, MongoClientOptions } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it as anyBackendIt, vi } from 'vitest';
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
  seedJournal,
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

/** Set by a cluster run: the fixture then connects to the Atlas cluster at this URI instead of Atlas Local. */
const NATIVE_CLUSTER = process.env.OWNERSHIP_TEST_URI !== undefined;
/**
 * `it` runs on Atlas Local only. A cluster run covers design §7's native set (P-ID, P-SAME, P-DIFF,
 * P-X8, P-LOST-a, P-DEL-ID, P-VRENAME, declared with `anyBackendIt`); the rest stub listings,
 * emulate the cluster or depend on Atlas Local behaviour, so they say nothing more on a cluster.
 */
const it = anyBackendIt.skipIf(NATIVE_CLUSTER);
/** Cluster mode is emulated on Atlas Local by `clusterCreateMode`; a real cluster answers an identical create with the existing id. */
const emulateCluster = (cluster: boolean) => cluster && !NATIVE_CLUSTER;

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
      const create = (s: MongoDBVector) => s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
      // allSettled right away, so no call rejects unhandled while the others are parked.
      const settled = Promise.allSettled([create(a), create(b), create(a), create(b), create(a)]);
      try {
        // If a call fails before the gate, the others would wait forever: release them after a bound.
        await Promise.race([all.promise, new Promise(r => setTimeout(r, 30_000))]);
      } finally {
        all.resolve();
        const results = await settled;
        checker.restoreHooks();
        for (const r of results) if (r.status === 'rejected') throw r.reason;
      }
      // Each call passes the hook at least once (a retried call passes it again).
      expect(arrived).toBeGreaterThanOrEqual(5);
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

    describe('stale delete and refresh across a delete and recreate', () => {
      /** Park `store`'s delete inside its first transaction attempt, after it read the entry. */
      function parkDelete(store: MongoDBVector) {
        const p = pause();
        hooks(store, {
          insideDeleteTransaction: async (_: string, attempt: number) => {
            if (attempt === 1) await p.hook();
          },
        });
        return p;
      }

      it('P-STALE-DEL-managed: a delete that read the old lifetime leaves a recreated managed index and its documents alone', async () => {
        const name = uniqueName('psdm');
        colls.push(name);
        await a.createIndex({ indexName: name, dimension: 4 });
        const original = (await entry(name))?.generation;
        const p = parkDelete(a);
        try {
          const del = a.deleteIndex({ indexName: name }).catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: name });
          // Atlas Local can briefly list the dropped collection's indexes as DOES_NOT_EXIST, a
          // retryable CONFLICT; retry as the error says.
          const stuck = createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT');
          await waitFor(() =>
            b.createIndex({ indexName: name, dimension: 4 }).then(
              () => true,
              e => (e?.id === stuck ? false : Promise.reject(e)),
            ),
          );
          await b.upsert({ indexName: name, vectors: [[1, 0, 0, 0]], ids: ['kept'] });
          p.release.resolve();
          expect(await del).toBeUndefined();
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
        const replacement = await entry(name);
        expect(replacement?.deleting).toBeUndefined();
        expect(typeof replacement?.generation).toBe('string');
        expect(replacement?.generation).not.toBe(original);
        expect(await db.collection(name).countDocuments({ _id: 'kept' as any })).toBe(1);
        expect(await searchIndexNames(db, name)).toContain(`${name}_vector_index`);
        // Atlas Local revives a dropped collection's search indexes when it is recreated, so the
        // replacement attaches them without recording ownership; a real cluster drops them.
        clean.opts = { expectedLeaks: [`${name}_vector_index`, `${name}_search_index`] };
      });

      it('P-STALE-DEL-byo: a delete that read the old lifetime leaves a recreated BYO registration and its search index alone', async () => {
        const coll = await byoColl('psdb');
        const vec = `${coll}_vector_index`;
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        const original = (await entry(coll))?.generation;
        const p = parkDelete(a);
        try {
          const del = a.deleteIndex({ indexName: coll }).catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: coll });
          await waitFor(async () => (await listedId(db, coll, vec)) === undefined);
          await b.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
          p.release.resolve();
          expect(await del).toBeUndefined();
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
        const replacement = await entry(coll);
        expect(replacement?.deleting).toBeUndefined();
        expect(replacement?.generation).not.toBe(original);
        expect(replacement?.ownsVectorIndex).toBe(true);
        const id = await listedId(db, coll, vec);
        expect(id).toBeDefined();
        expect(replacement?.indexIds).toEqual([{ name: vec, id }]);
      });

      it('a delete that read an entry without a generation refuses retryably when the entry gains one, dropping nothing', async () => {
        const name = uniqueName('psdl');
        colls.push(name);
        await a.createIndex({ indexName: name, dimension: 4 });
        await a.upsert({ indexName: name, vectors: [[1, 0, 0, 0]], ids: ['kept'] });
        // What a pre-generation instance left.
        await db.collection(REGISTRY).updateOne({ _id: name as any }, { $unset: { generation: '' } });
        const p = parkDelete(a);
        try {
          const del = a.deleteIndex({ indexName: name }).catch(e => e);
          await reached(p);
          // A backfill and a delete-and-recreate look the same from here.
          await db.collection(REGISTRY).updateOne({ _id: name as any }, { $set: { generation: 'other' } });
          p.release.resolve();
          const err = await del;
          expect(err?.id).toBe(createVectorErrorId('MONGODB', 'DELETE_INDEX', 'CONFLICT'));
          expect(err?.message).toBe(
            `Index "${name}" changed while deleteIndex ran, so nothing was dropped. Retry deleteIndex({ indexName: "${name}" }).`,
          );
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
        expect((await entry(name))?.deleting).toBeUndefined();
        expect(await db.collection(name).countDocuments({ _id: 'kept' as any })).toBe(1);
        await a.deleteIndex({ indexName: name });
        expect(await entry(name)).toBeNull();
      });

      /** Park `a`'s refresh of the writable BYO index `coll` after its read; run `between`; return its result. */
      async function staleRefresh(coll: string, between: () => Promise<unknown>) {
        const p = pause();
        hooks(a, { afterCreateIndexRead: p.hook });
        try {
          const refresh = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
          await reached(p);
          await between();
          p.release.resolve();
          return await refresh;
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
      }
      const retryText = (name: string) =>
        `Index "${name}" was registered or removed concurrently by another call while this one ran. Nothing was changed. Retry createIndex.`;

      it('P-STALE-REFRESH: a refresh that read a writable registration does not make its read-only replacement writable', async () => {
        const coll = await byoColl('psr');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll, allowWrites: true });
        const err = await staleRefresh(coll, async () => {
          await b.deleteIndex({ indexName: coll });
          await waitFor(async () => (await listedId(db, coll, `${coll}_vector_index`)) === undefined);
          await b.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        });
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(retryText(coll));
        expect((await entry(coll))?.allowWrites).toBe(false);
        const refused = await a.upsert({ indexName: coll, vectors: [[0, 1, 0, 0]], ids: ['w'] }).catch(e => e);
        expect(refused?.id).toBe(createVectorErrorId('MONGODB', 'UPSERT', 'READ_ONLY_INDEX'));
        expect(await db.collection(coll).countDocuments({ _id: 'w' as any })).toBe(0);
      });

      it('P-STALE-REFRESH-gone: a refresh that read a registration deleted meanwhile does not bring it back', async () => {
        const coll = await byoColl('psrg');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll, allowWrites: true });
        const err = await staleRefresh(coll, () => b.deleteIndex({ indexName: coll }));
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(retryText(coll));
        expect(await entry(coll)).toBeNull();
        await waitFor(async () => (await searchIndexNames(db, coll)).length === 0);
      });

      it('a stale managed refresh that recreated the deleted collection drops it again', async () => {
        const name = uniqueName('psro');
        colls.push(name);
        await a.createIndex({ indexName: name, dimension: 4 });
        const p = pause();
        hooks(a, { afterCreateIndexRead: p.hook });
        try {
          const refresh = a.createIndex({ indexName: name, dimension: 4 }).catch(e => e);
          await reached(p);
          await b.deleteIndex({ indexName: name });
          p.release.resolve();
          const err = await refresh;
          expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
          expect(err?.message).toBe(retryText(name));
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
        expect(await entry(name)).toBeNull();
        expect(await db.listCollections({ name }).hasNext()).toBe(false);
      });

      it('a refresh that read an entry without a generation re-reads a replacement instead of writing its stale policy', async () => {
        const coll = await byoColl('psrl');
        const legacy = {
          _id: coll,
          indexName: coll,
          collectionName: coll,
          searchIndexName: `${coll}_vector_index`,
          isByo: true,
          allowWrites: true,
          dimension: 4,
          metric: 'cosine',
        };
        await seedRegistry(db, legacy);
        const result = await staleRefresh(coll, async () => {
          await db.collection(REGISTRY).deleteOne({ _id: coll as any });
          await seedRegistry(db, { ...legacy, allowWrites: false, generation: 'replacement', claimToken: 'r', rev: 1 });
        });
        expect(result).toBeUndefined();
        const e = await entry(coll);
        expect(e?.generation).toBe('replacement');
        expect(e?.allowWrites).toBe(false);
      });

      it('identical concurrent refreshes of a registration all succeed on its generation', async () => {
        const coll = await byoColl('psrs');
        await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        const before = await entry(coll);
        const refresh = (s: MongoDBVector) => s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        await Promise.all([refresh(a), refresh(b), refresh(a), refresh(b), refresh(a)]);
        const after = await entry(coll);
        expect(after?.generation).toBe(before?.generation);
        expect(after?.rev).toBeGreaterThanOrEqual((before?.rev ?? 0) + 5);
      });
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

      // (vi), a delete between the read and P0, is covered by P-STALE-REFRESH-gone: P0 no longer re-inserts.

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
      anyBackendIt.skipIf(NATIVE_CLUSTER && !cluster)(
        'identical concurrent calls released in any order all succeed and record the listed id',
        async () => {
          const coll = await byoColl('pid');
          const gates = Array.from({ length: 5 }, () => deferred());
          const all = deferred();
          let arrived = 0;
          const beforeAtlasCreate = async () => {
            const gate = gates[arrived]!;
            if (++arrived === 5) all.resolve();
            await gate.promise;
          };
          const hooks = {
            beforeAtlasCreate,
            ...(emulateCluster(cluster) ? { createSearchIndexesCommand: clusterCreateMode(db) } : {}),
          };
          await withHooks([a, b], hooks, async () => {
            // allSettled right away, so no call rejects unhandled while the barrier waits.
            const settled = Promise.allSettled([a, b, a, b, a].map(s => createByo(s, coll)));
            let barrierFailed = false;
            try {
              // Bounded: fails after 15 s if a call never reaches the create.
              await reached({ reached: all });
              // A different release order on each run.
              for (const i of [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)) {
                gates[i]!.resolve();
                await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5)));
              }
            } catch (error) {
              barrierFailed = true;
              throw error;
            } finally {
              for (const g of gates) g.resolve();
              const results = await settled;
              // Report a call's failure, but never in place of the barrier's own.
              if (!barrierFailed) for (const r of results) if (r.status === 'rejected') throw r.reason;
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
        },
      );
    });

    describe.each<[string, 'vector' | 'text']>([
      ['createIndex', 'vector'],
      ['createSearchIndex', 'text'],
    ])('P-ID-68 (%s)', (_label, role) => {
      it('a create refused as the cluster refuses a concurrent duplicate (68) attaches, and the winner owns the index', async () => {
        const coll = await byoColl('pid68');
        const vec = `${coll}_vector_index`;
        const run = (s: MongoDBVector) =>
          role === 'vector' ? createByo(s, coll) : s.createSearchIndex({ indexName: coll, searchIndexName: 'N' });
        if (role === 'text') await createByo(a, coll);
        const name = role === 'vector' ? vec : 'N';
        let raced = false;
        await withHooks(
          [a],
          {
            // The other call's real create lands first; this one is then refused the way an Atlas cluster refuses it.
            createSearchIndexesCommand: async (command: Document, send: () => Promise<Document>) => {
              if (raced) return send();
              raced = true;
              await run(b);
              throw new MongoServerError({
                ok: 0,
                code: 68,
                codeName: 'IndexAlreadyExists',
                errmsg: `An index named "${command.indexes[0].name}" is already defined for collection ${coll}. Index names must be unique for a source collection and all its views.`,
              });
            },
          },
          () => run(a),
        );
        expect(raced).toBe(true);
        const e = await entry(coll);
        expect(role === 'vector' ? e?.ownsVectorIndex : e?.ownsTextIndex).toBe(true);
        expect(idOf(e, name)).toBe(await listedId(db, coll, name));
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
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

    anyBackendIt(
      'P-X8: an external identical create between P3a and P4 on the cluster is recorded as ours',
      async () => {
        const coll = await byoColl('px8');
        const vec = `${coll}_vector_index`;
        await withHooks(
          [a],
          {
            ...(emulateCluster(true) ? { createSearchIndexesCommand: clusterCreateMode(db) } : {}),
            beforeAtlasCreate: () => createRawSearchIndex(db, coll, vec, vectorDefinition),
          },
          () => createByo(a, coll),
        );
        const e = await entry(coll);
        expect(e?.ownsVectorIndex).toBe(true);
        expect(e?.indexIds?.[0]?.id).toBe(await listedId(db, coll, vec));
      },
    );

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
      anyBackendIt('P-VRENAME: a replaced vector index stays retired and is dropped by deleteIndex', async () => {
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

      /** `call` on `a` parks at `seam` while `between` runs; returns its error and the entry `between` left. */
      async function raceAt(coll: string, seam: string, call: () => Promise<unknown>, between: () => Promise<unknown>) {
        const p = pause();
        hooks(a, { [seam]: p.hook });
        try {
          const running = call().catch(e => e);
          await reached(p);
          await between();
          const left = await entry(coll);
          p.release.resolve();
          return { err: (await running) as any, left };
        } finally {
          p.release.resolve();
          checker.restoreHooks();
        }
      }

      it('P-XROLE-race (i): createIndex refuses a vector name a concurrent createSearchIndex took for text', async () => {
        const coll = await byoColl('pxrole1');
        await createByo(a, coll, { searchIndexName: 'V0' });
        const { err, left } = await raceAt(
          coll,
          'afterCreateIndexRead',
          () => createByo(a, coll, { searchIndexName: 'foo' }),
          () => b.createSearchIndex({ indexName: coll, searchIndexName: 'foo' }),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(left?.textSearchIndexName).toBe('foo');
        expect(await entry(coll)).toEqual(left);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-XROLE-race (ii): createIndex refuses a vector name a concurrent createSearchIndex retired as text', async () => {
        const coll = await byoColl('pxrole2');
        await createByo(a, coll, { searchIndexName: 'V0' });
        const { err, left } = await raceAt(
          coll,
          'afterCreateIndexRead',
          () => createByo(a, coll, { searchIndexName: 'foo' }),
          async () => {
            await b.createSearchIndex({ indexName: coll, searchIndexName: 'foo' });
            await b.createSearchIndex({ indexName: coll, searchIndexName: 'N2' });
          },
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(left?.retiredTextIndexNames).toEqual(['foo']);
        expect(await entry(coll)).toEqual(left);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('P-XROLE-race (iii): createSearchIndex refuses a text name a concurrent createIndex took for the vector', async () => {
        const coll = await byoColl('pxrole3');
        await createByo(a, coll, { searchIndexName: 'V0' });
        const { err, left } = await raceAt(
          coll,
          'afterCreateSearchIndexTarget',
          () => a.createSearchIndex({ indexName: coll, searchIndexName: 'foo' }),
          () => createByo(b, coll, { searchIndexName: 'foo' }),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
        expect(left?.searchIndexName).toBe('foo');
        expect(await entry(coll)).toEqual(left);
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      // PR #30067 review: a target resolved before a concurrent delete recreated the registration.
      it('P-STALE-TARGET: createSearchIndex whose registration is deleted after it resolved the target refuses and recreates nothing', async () => {
        const coll = await byoColl('pstale');
        await createByo(a, coll);
        const { err, left } = await raceAt(
          coll,
          'afterCreateSearchIndexTarget',
          () => a.createSearchIndex({ indexName: coll, searchIndexName: 'txt' }),
          () => b.deleteIndex({ indexName: coll }),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
        expect(left).toBeNull();
        expect(await entry(coll)).toBeNull();
        expect(await searchIndexNames(db, coll)).not.toContain('txt');
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

      it("R4-2: a delete releasing a co-owned index bumps the other owner's rev and sets a fresh claimToken", async () => {
        const coll = await byoColl('r42rel');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        await waitFor(async () => (await listedId(db, coll, 'A')) !== undefined);
        const r = await listedId(db, coll, 'A');
        const owner = { textSearchIndexName: 'A', ownsTextIndex: true, indexIds: [{ name: 'A', id: r }] };
        await seedUser(coll, 'y', { ...owner, generation: 'gy', rev: 1, claimToken: 'ty' });
        await seedUser(coll, 'z', { ...owner, generation: 'gz', rev: 1, claimToken: 'tz' });

        await a.deleteIndex({ indexName: `${coll}_y` });

        const z = await entry(`${coll}_z`);
        expect(z).toMatchObject({ ...owner, generation: 'gz', rev: 2 });
        expect(z?.claimToken).not.toBe('tz');
        expect(await listedId(db, coll, 'A')).toBe(r);
      });

      it('R4-2: a delete transferring an index to a referencing sibling bumps its rev and sets a fresh claimToken', async () => {
        const coll = await byoColl('r42xfer');
        await createRawSearchIndex(db, coll, 'A', textDefinition, 'search');
        await waitFor(async () => (await listedId(db, coll, 'A')) !== undefined);
        const r = await listedId(db, coll, 'A');
        await seedUser(coll, 'y', { textSearchIndexName: 'A', ownsTextIndex: true, indexIds: [{ name: 'A', id: r }] });
        await seedUser(coll, 'z', { textSearchIndexName: 'A', generation: 'gz', rev: 1, claimToken: 'tz' });

        await a.deleteIndex({ indexName: `${coll}_y` });

        const z = await entry(`${coll}_z`);
        expect(z).toMatchObject({ ownsTextIndex: true, indexIds: [{ name: 'A', id: r }], generation: 'gz', rev: 2 });
        expect(z?.claimToken).not.toBe('tz');
        expect(await listedId(db, coll, 'A')).toBe(r);
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

      anyBackendIt(
        'P-DEL-ID: a delete drops the incarnation it recorded, never a stranger recreated under the name',
        async () => {
          const coll = await byoColl('pdelid');
          await createRawSearchIndex(db, coll, 'N', textDefinition, 'search');
          const r = await listedId(db, coll, 'N');
          await seedUser(coll, 'a', {
            textSearchIndexName: 'N',
            ownsTextIndex: true,
            indexIds: [{ name: 'N', id: r }],
          });
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
        },
      );

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

    anyBackendIt(
      'P-LOST-a: a lost response with the index listed records it uncertain; deleteIndex keeps it and removes the record',
      async () => {
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
      },
    );

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

    it('P-CRASH-d: a crash after the proof is recorded by the reconciler, idempotently', async () => {
      const coll = await byoColl('pcrashd');
      const vec = `${coll}_vector_index`;
      await crashAt(coll, 'beforeRecordOwnership');
      const [j] = await docsOn(coll);
      expect(j).toMatchObject({ state: 'created', indexId: expect.any(String) });
      await reconcile(b, coll);
      await reconcile(b, coll);
      expect(await docsOn(coll)).toEqual([]);
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).toBe(true);
      expect(e?.indexIds).toEqual([{ name: vec, id: j!.indexId }]);
    });

    it('P-CRASH-e: a crash before the orphan drop is resumed by the reconciler, which drops R once', async () => {
      const coll = await byoColl('pcrashe');
      const vec = `${coll}_vector_index`;
      const c = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'j-crash' });
      await c.connect();
      const proven = pause();
      const dropping = pause();
      hooks(c, { leaseMs: 0, beforeRecordOwnership: proven.hook, beforeOrphanDrop: dropping.hook });
      void createByo(c, coll).catch(() => {});
      await reached(proven);
      const [j] = await docsOn(coll);
      // The registration goes, so the proven index takes the P7c path.
      await db.collection(REGISTRY).deleteOne({ _id: coll as any });
      proven.release.resolve();
      await reached(dropping);
      await c.disconnect();
      expect(await docsOn(coll)).toMatchObject([{ state: 'orphaned', dropDecided: true, indexId: j!.indexId }]);
      const { drops } = recordDrops(b);
      await reconcile(b, coll);
      await reconcile(b, coll);
      expect(drops).toEqual([{ collectionName: coll, name: vec, id: j!.indexId }]);
      expect(await docsOn(coll)).toEqual([]);
      await waitFor(async () => (await listedId(db, coll, vec)) === undefined);
    });

    it('RECON-BATCH: records that keep failing never starve a resolvable one', async () => {
      const coll = await byoColl('preconbatch');
      const stuck = Array.from({ length: 21 }, (_, i) => ({
        _id: `stuck-${coll}-${i}:vector`,
        indexName: `${coll}_gone`,
        generation: 'gone',
        collectionName: coll,
        name: `S${i}`,
        type: 'vectorSearch',
        role: 'vector',
        state: 'orphaned',
        dropDecided: true,
        indexId: new ObjectId().toHexString(),
        leaseUntil: new Date(0),
        createdAt: new Date(),
      }));
      for (const d of stuck) await seedJournal(db, d);
      // Expired after every stuck one; inserted last and named last, so last in index order too.
      await seedJournal(db, {
        ...stuck[0],
        _id: `ok-${coll}:vector`,
        name: 'Z',
        state: 'intent',
        leaseUntil: new Date(1000),
      });
      captureLogs(b);
      hooks(b, {
        beforeOrphanDrop: async (_i: string, name: string) => {
          if (name.startsWith('S')) throw new Error('injected drop failure');
        },
      });
      let calls = 0;
      while (calls < 3 && (await docsOn(coll)).some(d => d.state === 'intent')) {
        await reconcile(b, coll);
        calls++;
      }
      expect((await docsOn(coll)).filter(d => d.state === 'intent')).toEqual([]);
      expect(await docsOn(coll)).toHaveLength(21);
      clean.opts = { journalExpected: true };
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

    it('P2-DUP: an intent never overwrites an existing journal doc', async () => {
      const coll = await byoColl('p2dup');
      const token = `tok-${coll}`;
      const seeded = {
        _id: `${token}:vector`,
        indexName: coll,
        generation: 'g',
        collectionName: coll,
        name: 'V',
        type: 'vectorSearch',
        role: 'vector',
        state: 'orphaned',
        indexId: '1'.repeat(24),
        leaseUntil: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      await seedJournal(db, seeded);
      const abort = await (a as any)
        .provisionSearchIndex({
          indexName: coll,
          collection: (a as any).db.collection(coll),
          role: 'vector',
          op: 'CREATE_INDEX',
          description: { name: 'V', type: 'vectorSearch', definition: { fields: [] } },
          pin: { generation: 'g', claimToken: token, rev: 1 },
          check: async () => {},
        })
        .catch((e: any) => e);
      expect(abort?.error?.code).toBe(11000);
      expect(await docsOn(coll)).toEqual([seeded]);
      expect(await searchIndexNames(db, coll)).toEqual([]);
      await db.collection(JOURNAL).deleteMany({ collectionName: coll });
    });

    describe('P7b, P7c and orphan cleanup', () => {
      const P7B =
        'the target changed concurrently; the index this call created is kept as a retired index of the registration and removed by deleteIndex';
      const P7C =
        'the registration was removed or recreated while this call ran; what it created was handed over or removed';
      const idOf = (e: Document | null, name: string) =>
        e?.indexIds?.find((x: { name: string }) => x.name === name)?.id as string | undefined;
      const create = (s: MongoDBVector, coll: string, extra: Document = {}) =>
        s.createIndex({ indexName: coll, dimension: 4, collectionName: coll, ...extra });

      /** Start `call` with `a` parked at `seam`; run `between`; release; return the call's settled value. */
      async function parkedAt(seam: string, call: () => Promise<unknown>, between: () => Promise<unknown>) {
        const p = pause();
        hooks(a, { [seam]: p.hook });
        const running = call().catch(e => e);
        try {
          await reached(p);
          await between();
        } finally {
          p.release.resolve();
        }
        return running;
      }

      it('P-R1b: a vector index whose target changed in the same generation is retired with its id', async () => {
        const coll = await byoColl('pr1b');
        await create(a, coll, { searchIndexName: 'V0' });
        const err: any = await parkedAt(
          'beforeRecordOwnership',
          () => create(a, coll, { searchIndexName: 'V1' }),
          () => create(b, coll, { searchIndexName: 'V2' }),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(P7B);
        const e = await entry(coll);
        expect(e?.searchIndexName).toBe('V2');
        expect(e?.retiredVectorIndexNames).toEqual(expect.arrayContaining(['V0', 'V1']));
        expect(idOf(e, 'V1')).toBe(await listedId(db, coll, 'V1'));
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      // PR #30067 review: a refresh used to replace the claim token, so the creator's ownership write matched nothing.
      it('P-REFRESH-own: an identical refresh while the creator is about to record ownership leaves the index owned, and deleteIndex removes it', async () => {
        const name = uniqueName('prown');
        colls.push(name);
        const vec = `${name}_vector_index`;
        const err = await parkedAt(
          'beforeRecordOwnership',
          () => a.createIndex({ indexName: name, dimension: 4 }),
          () => b.createIndex({ indexName: name, dimension: 4 }),
        );
        expect(err).toBeUndefined();
        const e = await entry(name);
        expect(e?.ownsCollection).toBe(true);
        expect(e?.ownsVectorIndex).toBe(true);
        expect(idOf(e, vec)).toBe(await listedId(db, name, vec));
        await b.deleteIndex({ indexName: name });
        expect(await entry(name)).toBeNull();
        expect(await db.listCollections({ name }).hasNext()).toBe(false);
      });

      it('P-R2b: a refresh whose registration was recreated on another collection drops what it created', async () => {
        const x = await byoColl('pr2bx');
        const y = await byoColl('pr2by');
        const name = uniqueName('pr2b');
        await create(a, x, { indexName: name, searchIndexName: 'V0' });
        const err: any = await parkedAt(
          'beforeRecordOwnership',
          // A refresh that creates: a rename to V1.
          () => create(a, x, { indexName: name, searchIndexName: 'V1' }),
          async () => {
            await b.deleteIndex({ indexName: name });
            await create(b, y, { indexName: name });
          },
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(P7C);
        expect(err?.details?.cleanup).toBe('dropped');
        await waitFor(async () => (await searchIndexNames(db, x)).length === 0);
        const e = await entry(name);
        expect(e?.collectionName).toBe(y);
        expect(e?.ownsVectorIndex).toBe(true);
        expect(idOf(e, `${name}_vector_index`)).toBe(await listedId(db, y, `${name}_vector_index`));
        expect(await docsOn(x)).toEqual([]);
        await b.deleteIndex({ indexName: name });
      });

      it('P-R3b: a text index whose target changed in the same generation is retired with its id', async () => {
        const coll = await byoColl('pr3b');
        await create(a, coll);
        const err: any = await parkedAt(
          'beforeRecordOwnership',
          () => a.createSearchIndex({ indexName: coll, searchIndexName: 'N1' }),
          () => b.createSearchIndex({ indexName: coll, searchIndexName: 'N2' }),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'));
        expect(err?.message).toBe(P7B);
        const e = await entry(coll);
        expect(e?.textSearchIndexName).toBe('N2');
        expect(e?.retiredTextIndexNames).toContain('N1');
        expect(idOf(e, 'N1')).toBe(await listedId(db, coll, 'N1'));
      });

      describe.each<[string, boolean]>([
        ['local', false],
        ['cluster', true],
      ])('P-SAME (%s)', (_label, cluster) => {
        anyBackendIt.skipIf(NATIVE_CLUSTER && !cluster)(
          'a delete and identical recreate during provisioning ends owned with R',
          async () => {
            const coll = await byoColl('psame');
            const vec = `${coll}_vector_index`;
            if (cluster)
              hooks(b, {
                ...(emulateCluster(cluster) ? { createSearchIndexesCommand: clusterCreateMode(db) } : {}),
                // b's pre-lists ran before a's create landed, so b creates too and gets R back.
                listSearchIndexesStub: (_n: string, phase: string) =>
                  phase === 'P1' || phase === 'P3a' ? [] : undefined,
              });
            const err: any = await parkedAt(
              'beforeRecordOwnership',
              () => create(a, coll),
              async () => {
                await b.deleteIndex({ indexName: coll });
                await create(b, coll);
              },
            );
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err?.message).toBe(P7C);
            // On a cluster the new generation may itself prove R, so the orphan is released rather than transferred.
            expect(['transferred', 'released']).toContain(err?.details?.cleanup);
            const e = await entry(coll);
            expect(e?.ownsVectorIndex).toBe(true);
            expect(e?.indexIds).toEqual([{ name: vec, id: await listedId(db, coll, vec) }]);
            expect(await docsOn(coll)).toEqual([]);
          },
        );
      });

      describe.each<[string, boolean]>([
        ['local', false],
        ['cluster', true],
      ])('P-DIFF (%s)', (_label, cluster) => {
        anyBackendIt.skipIf(NATIVE_CLUSTER && !cluster)(
          'a delete and recreate on another collection during provisioning drops R by id',
          async () => {
            const x = await byoColl('pdiffx');
            const y = await byoColl('pdiffy');
            const name = uniqueName('pdiff');
            const vec = `${name}_vector_index`;
            if (emulateCluster(cluster))
              for (const s of [a, b]) hooks(s, { createSearchIndexesCommand: clusterCreateMode(db) });
            const { drops } = recordDrops(a);
            let r: string | undefined;
            const err: any = await parkedAt(
              'beforeRecordOwnership',
              () => create(a, x, { indexName: name }),
              async () => {
                r = await listedId(db, x, vec);
                await b.deleteIndex({ indexName: name });
                await create(b, y, { indexName: name });
              },
            );
            expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'));
            expect(err?.message).toBe(P7C);
            expect(r).toBeDefined();
            expect(drops).toEqual([{ collectionName: x, name: vec, id: r }]);
            await waitFor(async () => (await searchIndexNames(db, x)).length === 0);
            expect((await entry(name))?.collectionName).toBe(y);
            expect(await docsOn(x)).toEqual([]);
            await b.deleteIndex({ indexName: name });
          },
        );
      });

      it('P-ABA-inflight: A -> B in flight, then back to A: A owned, B retired with its id', async () => {
        const coll = await byoColl('pabain');
        await create(a, coll, { searchIndexName: 'A' });
        const err: any = await parkedAt(
          'beforeRecordOwnership',
          () => create(a, coll, { searchIndexName: 'B' }),
          () => create(b, coll, { searchIndexName: 'A' }),
        );
        expect(err?.message).toBe(P7B);
        const e = await entry(coll);
        expect(e?.searchIndexName).toBe('A');
        expect(e?.ownsVectorIndex).toBe(true);
        expect(e?.retiredVectorIndexNames).toEqual(['B']);
        expect(idOf(e, 'B')).toBe(await listedId(db, coll, 'B'));
        await a.deleteIndex({ indexName: coll });
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      describe.each<[string, boolean]>([
        ['R listed', true],
        ['R not listed', false],
      ])('P-STALEID-ORPHAN (%s)', (_label, listed) => {
        it('a stale-id owner blocks the drop; its id becomes R only when the listing shows R', async () => {
          const STALE = '0'.repeat(24);
          const coll = await byoColl('pstaleorph');
          await createRawSearchIndex(db, coll, 'N', { mappings: { dynamic: true } }, 'search');
          const r = (await listedId(db, coll, 'N'))!;
          const seedUser = (key: string, extra: Document) =>
            seedRegistry(db, {
              _id: `${coll}_${key}`,
              indexName: `${coll}_${key}`,
              collectionName: coll,
              searchIndexName: `${coll}_${key}_vec`,
              isByo: true,
              allowWrites: false,
              generation: 'g',
              rev: 1,
              claimToken: 't',
              ...extra,
            });
          await seedUser('u1', { textSearchIndexName: 'N', ownsTextIndex: true, indexIds: [{ name: 'N', id: STALE }] });
          await seedUser('u2', { textSearchIndexName: 'N' });
          const doc = {
            _id: `orphan-${coll}:text`,
            indexName: `${coll}_gone`,
            generation: 'gone',
            collectionName: coll,
            name: 'N',
            type: 'search',
            role: 'text',
            state: 'orphaned',
            indexId: r,
            leaseUntil: new Date(Date.now() + 300_000),
            createdAt: new Date(),
          };
          await seedJournal(db, doc);
          const logs = captureLogs(b);
          const { drops } = recordDrops(b);
          if (!listed)
            hooks(b, { listSearchIndexesStub: (_n: string, phase: string) => (phase === 'orphan' ? [] : undefined) });
          expect(await (b as any).cleanupOrphan(doc, 2)).toBe('released');
          const u1 = await entry(`${coll}_u1`);
          expect(u1?.indexIds).toEqual([{ name: 'N', id: listed ? r : STALE }]);
          expect(u1?.rev).toBe(2);
          expect(u1?.claimToken).not.toBe('t');
          expect((await entry(`${coll}_u2`))?.rev).toBe(1);
          expect(await docsOn(coll)).toEqual([]);
          expect(drops).toEqual([]);
          expect(await listedId(db, coll, 'N')).toBe(r);
          if (!listed) {
            expect(logs.warn.some(m => m.includes('"N"') && m.includes(STALE) && m.includes(r))).toBe(true);
            clean.opts = { userIndexes: ['N'] };
          }
        });
      });

      /** A vector index `N` on a fresh collection, and an `orphaned` cleanup record for it (lease active by default). */
      async function seedOrphan(prefix: string, leaseUntil = new Date(Date.now() + 300_000)) {
        const coll = await byoColl(prefix);
        await createRawSearchIndex(db, coll, 'N', {
          fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
        });
        await waitFor(async () => (await listedId(db, coll, 'N')) !== undefined);
        const r = (await listedId(db, coll, 'N'))!;
        const doc = {
          _id: `orphan-${coll}:vector`,
          indexName: `${coll}_gone`,
          generation: 'gone',
          collectionName: coll,
          name: 'N',
          type: 'vectorSearch',
          role: 'vector',
          state: 'orphaned',
          indexId: r,
          leaseUntil,
          createdAt: new Date(),
        };
        await seedJournal(db, doc);
        return { coll, r, doc };
      }
      const m8 = (coll: string, record: string) =>
        `search index "N" on "${coll}" is pending removal of an index Mastra created (cleanup record ${record}). Retry: retrying runs the cleanup. If the drop keeps failing, the block remains and the failure is logged at error level.`;
      const attachN = (coll: string) => create(a, coll, { indexName: `${coll}_c`, searchIndexName: 'N' });

      it('R11-DECIDED: a second cleaner follows a decided drop; an attach written after the decision is refused, never handed R', async () => {
        const { coll, r, doc } = await seedOrphan('r11dec');
        const pB = pause();
        const pC = pause();
        const pA = pause();
        hooks(b, { beforeOrphanDrop: pB.hook });
        hooks(a, { beforePendingDropCheck: pC.hook, beforeOrphanDrop: pA.hook });
        const dropsA = recordDrops(a).drops;
        const dropsB = recordDrops(b).drops;
        const cleanerB = (b as any).cleanupOrphan(doc, 2).catch((e: unknown) => e);
        let cleanerA: Promise<unknown> | undefined;
        let attach: any;
        try {
          // B saw no user and decided to drop.
          await reached(pB);
          expect(await docsOn(coll)).toMatchObject([{ state: 'orphaned', dropDecided: true }]);
          // C writes its registration of N; its handshake has not run yet.
          const c = attachN(coll).catch(e => e);
          await reached(pC);
          // A sees C, but follows B's decision instead of handing R to C.
          cleanerA = (a as any).cleanupOrphan(doc, 2).catch((e: unknown) => e);
          await reached(pA);
          expect((await entry(`${coll}_c`))?.ownsVectorIndex).not.toBe(true);
          pC.release.resolve();
          attach = await c;
        } finally {
          pC.release.resolve();
          pA.release.resolve();
          pB.release.resolve();
        }
        expect(attach?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
        expect(attach?.message).toBe(m8(coll, doc._id));
        expect(await cleanerA).toBe('dropped');
        expect(await cleanerB).toBe('dropped');
        expect(await entry(`${coll}_c`)).toBeNull();
        expect(await docsOn(coll)).toEqual([]);
        for (const d of [...dropsA, ...dropsB]) expect(d).toEqual({ collectionName: coll, name: 'N', id: r });
        await waitFor(async () => (await listedId(db, coll, 'N')) === undefined);
      });

      it('R11-SERIAL: concurrent step-3 transactions on one cleanup record hand R over exactly once', async () => {
        const { coll, r, doc } = await seedOrphan('r11ser');
        const pC = pause();
        const both = deferred();
        let arrived = 0;
        // Both transactions read J before either writes, so one must conflict and re-read; the
        // barrier opens once, so the retried attempt passes straight through.
        const afterOrphanJournalRead = async () => {
          if (++arrived === 2) both.resolve();
          await reached({ reached: both });
        };
        hooks(a, { beforePendingDropCheck: pC.hook, afterOrphanJournalRead });
        hooks(b, { afterOrphanJournalRead });
        const c = attachN(coll).catch(e => e);
        let results: unknown[];
        let rev: number;
        try {
          await reached(pC);
          rev = (await entry(`${coll}_c`))!.rev;
          results = await Promise.all([a, b].map(s => (s as any).cleanupOrphan(doc, 2)));
        } finally {
          pC.release.resolve();
        }
        expect(results.sort()).toEqual(['kept', 'transferred']);
        expect(await c).toBeUndefined();
        const e = await entry(`${coll}_c`);
        expect(e?.ownsVectorIndex).toBe(true);
        expect(e?.indexIds).toEqual([{ name: 'N', id: r }]);
        // One transfer: rev + 1 over the attach's P0.
        expect(e?.rev).toBe(rev + 1);
        expect(await docsOn(coll)).toEqual([]);
        expect(await listedId(db, coll, 'N')).toBe(r);
      });

      it('ORPHAN-DROP-FAIL: a failed drop keeps the decided record, which blocks attaches, and logs at error', async () => {
        const { coll, r, doc } = await seedOrphan('pdropfail');
        const logs = captureLogs(b);
        const failDrop = async () => {
          throw new Error('injected drop failure');
        };
        // The attach below retries the cleanup (R14), so its store's drop fails as well.
        for (const s of [a, b]) hooks(s, { beforeOrphanDrop: failDrop });
        expect(await (b as any).cleanupOrphan(doc, 2)).toBe('failed');
        const [kept] = await docsOn(coll);
        expect(kept).toMatchObject({ state: 'orphaned', dropDecided: true, indexId: r });
        // R14: the failed drop expires the record, so the next call retries it at once.
        expect(kept!.leaseUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        expect(logs.error.some(m => m.includes(r) && m.includes(doc._id) && m.includes('injected'))).toBe(true);
        const attach: any = await attachN(coll).catch(e => e);
        expect(attach?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
        expect(attach?.message).toBe(m8(coll, doc._id));
        expect(await entry(`${coll}_c`)).toBeNull();
        expect(await listedId(db, coll, 'N')).toBe(r);
        clean.opts = { journalExpected: true };
      });

      it('R12-P1: an attach whose listing saw R before a cleanup dropped it never attaches the dropped index', async () => {
        const { coll, r, doc } = await seedOrphan('r12p1');
        const pB = pause();
        const pC = pause();
        hooks(b, { beforeOrphanDrop: pB.hook });
        // C lists N (P1) and then parks at the start of its handshake.
        hooks(a, { beforePendingDropCheck: pC.hook });
        const cleanerB = (b as any).cleanupOrphan(doc, 2).catch((e: unknown) => e);
        let c: Promise<any> | undefined;
        try {
          // B decided to drop before C wrote anything.
          await reached(pB);
          c = attachN(coll).catch(e => e);
          await reached(pC);
          pB.release.resolve();
          expect(await cleanerB).toBe('dropped');
          expect(await docsOn(coll)).toEqual([]);
        } finally {
          pB.release.resolve();
          pC.release.resolve();
        }
        const result = await c;
        const now = await listedId(db, coll, 'N');
        const e = await entry(`${coll}_c`);
        if (result === undefined) {
          // Provisioned afresh: C owns a new incarnation, never R.
          expect(now).toBeDefined();
          expect(now).not.toBe(r);
          expect(e?.ownsVectorIndex).toBe(true);
          expect(idOf(e, 'N')).toBe(now);
        } else {
          // Or refused while R is still being removed, and rolled back.
          expect([
            createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
            createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'),
          ]).toContain(result?.id);
          expect(e).toBeNull();
        }
        // C was written after B's durable decision, so it does not block B's drop (R13); the checker
        // instead verifies after the test that C is not left on the dropped R.
        expect(checker.violations).toEqual([]);
      });

      describe('P-RECON-RACE', () => {
        /** Run `reconcile` on stores a and b, both parked at `seam` until both arrived. */
        async function bothAt(seam: string, coll: string) {
          const pa = pause();
          const pb = pause();
          hooks(a, { [seam]: pa.hook });
          hooks(b, { [seam]: pb.hook });
          const runs = [reconcile(a, coll), reconcile(b, coll)];
          try {
            await reached(pa);
            await reached(pb);
          } finally {
            pa.release.resolve();
            pb.release.resolve();
          }
          await Promise.all(runs);
        }

        it('two reconcilers on one created record record ownership once', async () => {
          const coll = await byoColl('preconrc');
          const vec = `${coll}_vector_index`;
          await crashAt(coll, 'beforeRecordOwnership');
          const [j] = await docsOn(coll);
          const rev = (await entry(coll))!.rev;
          const logsA = captureLogs(a);
          const logsB = captureLogs(b);
          await bothAt('beforeRecordOwnership', coll);
          const e = await entry(coll);
          expect(e?.ownsVectorIndex).toBe(true);
          expect(e?.indexIds).toEqual([{ name: vec, id: j!.indexId }]);
          expect(e?.rev).toBe(rev + 1);
          expect(await docsOn(coll)).toEqual([]);
          expect([...logsA.warn, ...logsA.error, ...logsB.warn, ...logsB.error]).toEqual([]);
        });

        it('two reconcilers on one orphaned record drop R by id, without error', async () => {
          const { coll, r } = await seedOrphan('preconro', new Date(0));
          const logsA = captureLogs(a);
          const logsB = captureLogs(b);
          const drops = [a, b].map(s => recordDrops(s).drops);
          await bothAt('beforeOrphanDrop', coll);
          // Both follow the one durable decision (R11); a drop by id is idempotent, so the second is a no-op.
          const all = drops.flat();
          expect(all.length).toBeGreaterThan(0);
          for (const d of all) expect(d).toEqual({ collectionName: coll, name: 'N', id: r });
          expect(await docsOn(coll)).toEqual([]);
          expect([...logsA.warn, ...logsA.error, ...logsB.warn, ...logsB.error]).toEqual([]);
          await waitFor(async () => (await listedId(db, coll, 'N')) === undefined);
        });
      });

      describe.each(['beforeProof', 'beforeRecordOwnership', 'afterOrphanMarked', 'beforeOrphanDrop'])(
        'P-RECON-LIVE (%s)',
        seam => {
          it('a reconciler running while the op is parked past its lease ends as the sequential run', async () => {
            const coll = await byoColl('preconlive');
            const vec = `${coll}_vector_index`;
            const orphan = seam === 'afterOrphanMarked' || seam === 'beforeOrphanDrop';
            const proven = pause();
            const p = pause();
            hooks(a, { leaseMs: 0, ...(orphan ? { beforeRecordOwnership: proven.hook } : {}), [seam]: p.hook });
            const { drops } = recordDrops(b);
            const call = create(a, coll).catch(e => e);
            let r: string | undefined;
            try {
              if (orphan) {
                await reached(proven);
                // The registration goes, so the op takes the P7c path.
                await db.collection(REGISTRY).deleteOne({ _id: coll as any });
                proven.release.resolve();
              }
              await reached(p);
              r = (await docsOn(coll))[0]?.indexId;
              await reconcile(b, coll);
            } finally {
              proven.release.resolve();
              p.release.resolve();
            }
            const result: any = await call;
            if (orphan) {
              // The reconciler's orphaned branch did the cleanup.
              expect(drops).toEqual([{ collectionName: coll, name: vec, id: r }]);
              expect(result?.message).toBe(P7C);
              expect(await entry(coll)).toBeNull();
              await waitFor(async () => (await listedId(db, coll, vec)) === undefined);
            } else {
              expect(result).toBeUndefined();
              const e = await entry(coll);
              expect(e?.ownsVectorIndex).toBe(true);
              expect(e?.indexIds).toEqual([{ name: vec, id: await listedId(db, coll, vec) }]);
            }
            expect(await docsOn(coll)).toEqual([]);
            expect(checker.violations).toEqual([]);
          });
        },
      );

      it('P-STALE-ORPHAN: a stale record whose drop fails refuses the attach with M8; an immediate retry runs the cleanup', async () => {
        const { coll, r, doc } = await seedOrphan('pstaleorph', new Date(0));
        const logs = captureLogs(a);
        const { drops } = recordDrops(a);
        // The default lease: a failed drop expires the record (R14), so an immediate retry cleans it.
        hooks(a, {
          beforeOrphanDrop: async () => {
            throw new Error('injected drop failure');
          },
        });
        const refused: any = await attachN(coll).catch(e => e);
        expect(refused?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
        expect(refused?.message).toBe(m8(coll, doc._id));
        expect(logs.error).toHaveLength(1);
        expect(logs.error[0]).toContain(doc._id);
        expect(await entry(`${coll}_c`)).toBeNull();
        expect(await listedId(db, coll, 'N')).toBe(r);
        delete (a as any).testHooks.beforeOrphanDrop;
        await attachN(coll);
        expect(drops).toEqual([{ collectionName: coll, name: 'N', id: r }]);
        expect(await docsOn(coll)).toEqual([]);
        const e = await entry(`${coll}_c`);
        expect(e?.searchIndexName).toBe('N');
        expect(idOf(e, 'N')).not.toBe(r);
        expect(logs.error).toHaveLength(1);
      });

      it('P-STALE-ORPHAN (handshake): a stale record the call did not reconcile is cleaned once, then re-checked', async () => {
        const { coll, r, doc } = await seedOrphan('pstaleorphh');
        await db.collection(JOURNAL).deleteOne({ _id: doc._id as any });
        const p = pause();
        hooks(a, { beforePendingDropCheck: p.hook });
        const c = attachN(coll).catch(e => e);
        try {
          // After the call's own reconcile and P0: only the handshake can see it.
          await reached(p);
          await seedJournal(db, { ...doc, leaseUntil: new Date(0) });
        } finally {
          p.release.resolve();
        }
        expect(await c).toBeUndefined();
        const e = await entry(`${coll}_c`);
        expect(e?.ownsVectorIndex).toBe(true);
        expect(e?.indexIds).toEqual([{ name: 'N', id: r }]);
        expect(await docsOn(coll)).toEqual([]);
        expect(await listedId(db, coll, 'N')).toBe(r);
      });

      describe('P-ATTACH-ORPHAN', () => {
        it('an attach before the mark gets the index handed over', async () => {
          const coll = await byoColl('pattach1');
          const vec = `${coll}_vector_index`;
          const err: any = await parkedAt(
            'beforeRecordOwnership',
            () => create(a, coll),
            async () => {
              await b.deleteIndex({ indexName: coll });
              await create(b, coll, { indexName: `${coll}_c`, searchIndexName: vec });
            },
          );
          expect(err?.message).toBe(P7C);
          const c = await entry(`${coll}_c`);
          expect(c?.ownsVectorIndex).toBe(true);
          expect(c?.indexIds).toEqual([{ name: vec, id: await listedId(db, coll, vec) }]);
          expect(await docsOn(coll)).toEqual([]);
        });

        it('an attach after the mark refuses with INDEX_DELETING and the orphan is dropped', async () => {
          const coll = await byoColl('pattach2');
          const vec = `${coll}_vector_index`;
          const parked = pause();
          const marked = pause();
          hooks(a, { beforeRecordOwnership: parked.hook, afterOrphanMarked: marked.hook });
          const { drops } = recordDrops(a);
          const call = create(a, coll).catch(e => e);
          let attach: any;
          let cleanupRecord: string | undefined;
          try {
            await reached(parked);
            await b.deleteIndex({ indexName: coll });
            parked.release.resolve();
            // The P7c path, parked right after the mark.
            await reached(marked);
            const [doc] = await docsOn(coll);
            expect(doc?.state).toBe('orphaned');
            cleanupRecord = doc?._id;
            attach = await create(b, coll, { indexName: `${coll}_c`, searchIndexName: vec }).catch(e => e);
          } finally {
            parked.release.resolve();
            marked.release.resolve();
          }
          expect((await call)?.message).toBe(P7C);
          expect(attach?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INDEX_DELETING'));
          expect(attach?.message).toBe(
            `search index "${vec}" on "${coll}" is pending removal of an index Mastra created (cleanup record ${cleanupRecord}). Retry: retrying runs the cleanup. If the drop keeps failing, the block remains and the failure is logged at error level.`,
          );
          expect(await entry(`${coll}_c`)).toBeNull();
          expect(drops).toEqual([{ collectionName: coll, name: vec, id: expect.any(String) }]);
          expect(await docsOn(coll)).toEqual([]);
          expect(checker.violations).toEqual([]);
        });
      });

      describe('P-CLAIM-ORPHAN', () => {
        const claimErr = (code: string) => createVectorErrorId('MONGODB', 'CLAIM_LEGACY_INDEX', code);
        const RELIST = 'index changed while it was being claimed; nothing was claimed; retry';

        /**
         * Unregistered collection X with `${X}_vector_index` = N (id R), and, unless `state` is null,
         * a cleanup record J for N of a gone lifetime (expired lease by default).
         */
        async function legacyWithRecord(
          prefix: string,
          state: 'orphaned' | 'created' | null,
          leaseUntil = new Date(0),
        ) {
          const coll = await byoColl(prefix);
          const n = `${coll}_vector_index`;
          await createRawSearchIndex(db, coll, n, {
            fields: [{ type: 'vector', path: 'embedding', numDimensions: 4, similarity: 'cosine' }],
          });
          await waitFor(async () => (await listedId(db, coll, n)) !== undefined);
          const r = (await listedId(db, coll, n))!;
          const doc = {
            _id: `orphan-${coll}:vector`,
            indexName: `${coll}_gone`,
            generation: 'gone',
            collectionName: coll,
            name: n,
            type: 'vectorSearch',
            role: 'vector',
            state,
            indexId: r,
            leaseUntil,
            createdAt: new Date(),
          };
          if (state) await seedJournal(db, doc);
          return { coll, n, r, doc };
        }
        const claim = (coll: string) => a.claimLegacyIndex({ indexName: coll }).catch(e => e);

        it('P-CLAIM-ORPHAN: a claim of a name pending orphan removal refuses with INDEX_DELETING, and the orphan is dropped', async () => {
          const { coll, n, r, doc } = await legacyWithRecord('pclaim', 'orphaned');
          const pB = pause();
          hooks(b, { beforeOrphanDrop: pB.hook });
          const { drops } = recordDrops(b);
          const cleaner = reconcile(b, coll);
          let err: any;
          try {
            // B decided to drop, which renewed the lease.
            await reached(pB);
            err = await claim(coll);
          } finally {
            pB.release.resolve();
          }
          await cleaner;
          expect(err?.id).toBe(claimErr('INDEX_DELETING'));
          expect(err?.message).toBe(
            `search index "${n}" on "${coll}" is pending removal of an index Mastra created (cleanup record ${doc._id}). Retry: retrying runs the cleanup. If the drop keeps failing, the block remains and the failure is logged at error level.`,
          );
          expect(await entry(coll)).toBeNull();
          expect(drops).toEqual([{ collectionName: coll, name: n, id: r }]);
          expect(await docsOn(coll)).toEqual([]);
        });

        // Spec variant (1) is "a claim committed before the mark", so J is still `created` here: an
        // `orphaned` J with a live lease would refuse the claim (I7).
        it('P-CLAIM-ORPHAN (1): a claim committed before the mark is seen by the cleanup, which keeps R', async () => {
          // A long lease, so the claim's own reconcile can't take J however slow the setup was.
          const { coll, n, r, doc } = await legacyWithRecord('pclaim1', 'created', new Date(Date.now() + 300_000));
          const { drops } = recordDrops(b);
          await a.claimLegacyIndex({ indexName: coll });
          expect((await entry(coll))?.indexIds).toEqual([{ name: n, id: r }]);
          expect(await docsOn(coll)).toHaveLength(1);
          // Only now does the lease expire, so the cleanup runs after the claim.
          await db.collection(JOURNAL).updateOne({ _id: doc._id as any }, { $set: { leaseUntil: new Date(0) } });
          await reconcile(b, coll);
          expect(drops).toEqual([]);
          expect(await docsOn(coll)).toEqual([]);
          expect(await entry(coll)).toMatchObject({ ownsVectorIndex: true, indexIds: [{ name: n, id: r }] });
          expect(await listedId(db, coll, n)).toBe(r);
        });

        it('P-CLAIM-ORPHAN (2): a cleanup releasing to the claim entry after its handshake saw J makes the undo miss', async () => {
          const { coll, n, r } = await legacyWithRecord('pclaim2', 'created');
          const pB = pause();
          const pA = pause();
          hooks(b, { afterOrphanMarked: pB.hook });
          hooks(a, { beforeClaimUndo: pA.hook });
          const { drops } = recordDrops(b);
          const cleaner = reconcile(b, coll);
          let claimed: Promise<any> | undefined;
          try {
            await reached(pB);
            claimed = claim(coll);
            await reached(pA);
            pB.release.resolve();
            await cleaner;
            expect(await docsOn(coll)).toEqual([]);
          } finally {
            pB.release.resolve();
            pA.release.resolve();
          }
          expect(await claimed).toBeUndefined();
          expect(await entry(coll)).toMatchObject({ ownsVectorIndex: true, indexIds: [{ name: n, id: r }] });
          expect(drops).toEqual([]);
          expect(await listedId(db, coll, n)).toBe(r);
        });

        it('P-CLAIM-ORPHAN (3): a drop decided before the claim wrote makes the re-list undo the claim with CONFLICT', async () => {
          const { coll, n, r } = await legacyWithRecord('pclaim3', 'orphaned');
          const pB = pause();
          const pA = pause();
          hooks(b, { beforeOrphanDrop: pB.hook });
          hooks(a, { afterClaimWrite: pA.hook });
          const { drops } = recordDrops(b);
          const cleaner = reconcile(b, coll);
          let claimed: Promise<any> | undefined;
          try {
            await reached(pB);
            claimed = claim(coll);
            await reached(pA);
            pB.release.resolve();
            await cleaner;
          } finally {
            pB.release.resolve();
            pA.release.resolve();
          }
          const err = await claimed;
          expect(err?.id).toBe(claimErr('CONFLICT'));
          expect(err?.message).toBe(RELIST);
          expect(await entry(coll)).toBeNull();
          expect(drops).toEqual([{ collectionName: coll, name: n, id: r }]);
          expect(await docsOn(coll)).toEqual([]);
        });

        it('P-CLAIM-ORPHAN (dropped): a claim that lists only the DELETING row of a dropped orphan claims nothing', async () => {
          const { coll, n, r, doc } = await legacyWithRecord('pclaimdel', 'orphaned');
          await db.collection(JOURNAL).updateOne({ _id: doc._id as any }, { $set: { dropDecided: true } });
          const { drops } = recordDrops(b);
          // §3.8 step 4 drops R and deletes J.
          await reconcile(b, coll);
          expect(drops).toEqual([{ collectionName: coll, name: n, id: r }]);
          expect(await docsOn(coll)).toEqual([]);
          // The dropped index is still listed, as DELETING, at both of the claim's listings.
          hooks(a, {
            listSearchIndexesStub: (name: string, phase: string) =>
              phase === 'claim' && name === n ? [{ id: r, name: n, status: 'DELETING' }] : undefined,
          });
          const err = await claim(coll);
          expect([claimErr('NOT_FOUND'), claimErr('CONFLICT')]).toContain(err?.id);
          if (err?.id === claimErr('CONFLICT')) expect(err.message).toBe(RELIST);
          expect(await entry(coll)).toBeNull();
        });

        it('P-CLAIM-ORPHAN (4): a delete handing N over to the claim entry after its handshake makes the undo miss', async () => {
          const { coll, n, r } = await legacyWithRecord('pclaim4', null);
          const y = `${coll}_y`;
          const pI = pause();
          const pU = pause();
          const pD = pause();
          hooks(a, { beforeClaimInsert: pI.hook, beforeClaimUndo: pU.hook });
          hooks(b, { beforeDeleteDrop: pD.hook });
          const { drops } = recordDrops(b);
          let claimed: Promise<any> | undefined;
          let deleted: Promise<any> | undefined;
          try {
            claimed = claim(coll);
            await reached(pI);
            await seedRegistry(db, {
              _id: y,
              indexName: y,
              collectionName: coll,
              searchIndexName: n,
              isByo: true,
              allowWrites: true,
              ownsVectorIndex: true,
              indexIds: [{ name: n, id: r }],
              generation: 'gy',
              rev: 1,
              claimToken: 'ty',
            });
            // T1 commits N in Y's drop set.
            deleted = b.deleteIndex({ indexName: y }).catch(e => e);
            await reached(pD);
            pI.release.resolve();
            // The claim's handshake saw the drop set.
            await reached(pU);
            pD.release.resolve();
            expect(await deleted).toBeUndefined();
          } finally {
            pI.release.resolve();
            pD.release.resolve();
            pU.release.resolve();
          }
          expect(await claimed).toBeUndefined();
          expect(await listedId(db, coll, n)).toBe(r);
          expect(await entry(coll)).toMatchObject({ ownsVectorIndex: true, indexIds: [{ name: n, id: r }] });
          expect(await entry(y)).toBeNull();
          expect(drops).toEqual([]);
        });
      });
    });
  });
});
