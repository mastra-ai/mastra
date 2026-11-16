import { createVectorErrorId } from '@mastra/core/storage';
import { MongoNetworkError, MongoServerError, ObjectId } from 'mongodb';
import type { CommandStartedEvent, Db, Document, MongoClient, MongoClientOptions } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
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
} from './__fixtures__/atlas-local';
import { MongoDBVector } from './';

vi.setConfig({ testTimeout: 300000, hookTimeout: 300000 });

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
    const colls: string[] = [];
    const entry = (name: string) => db.collection(REGISTRY).findOne({ _id: name as any });

    beforeAll(async () => {
      a = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'gen-a' });
      b = new MongoDBVector({ uri: ATLAS_LOCAL_URI, dbName: DB_NAME, id: 'gen-b' });
      await a.connect();
      await b.connect();
    });

    afterAll(async () => {
      for (const c of colls) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
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
      (a as any).testHooks = { beforePendingDropCheck: hook };
      (b as any).testHooks = { beforePendingDropCheck: hook };
      try {
        const create = (s: MongoDBVector) => s.createIndex({ indexName: coll, dimension: 4, collectionName: coll });
        await Promise.all([create(a), create(b), create(a), create(b), create(a)]);
      } finally {
        (a as any).testHooks = undefined;
        (b as any).testHooks = undefined;
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
      (a as any).testHooks = { beforePendingDropCheck: p.hook };
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
        (a as any).testHooks = undefined;
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
        (a as any).testHooks = {
          beforeSearchIndexProvision: async () => {
            await sample();
            await concurrent();
            afterWrite = await sample();
            throw new Error('provision failed');
          },
        };
        try {
          await expect(a.createSearchIndex({ indexName: coll, searchIndexName: 'B' })).rejects.toThrow(
            'provision failed',
          );
        } finally {
          (a as any).testHooks = undefined;
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
        (a as any).testHooks = {
          afterCreateIndexRead: p.hook,
          beforePendingDropCheck: async () => {
            throw new Error('provision failed');
          },
        };
        try {
          const call = a.createIndex({ indexName: coll, dimension: 4, collectionName: coll, ...params }).catch(e => e);
          await reached(p);
          await between();
          p.release.resolve();
          return await call;
        } finally {
          p.release.resolve();
          (a as any).testHooks = undefined;
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
    });

    // The seam sends the real create, so a live row exists, then reports `error` instead of the reply.
    async function createWithRefusal(error: MongoServerError) {
      const coll = await byoColl('refuse');
      (a as any).testHooks = {
        createSearchIndexesCommand: async (_cmd: Document, run: () => Promise<Document>) => {
          await run();
          throw error;
        },
      };
      try {
        const result = await a.createIndex({ indexName: coll, dimension: 4, collectionName: coll }).catch(e => e);
        return { coll, result };
      } finally {
        (a as any).testHooks = undefined;
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
    });

    it('attaches as uncertain, never owning, when a create errors in a way its own create may have landed', async () => {
      const logs = captureLogs(a);
      const { coll, result } = await createWithRefusal(
        new MongoServerError({ code: 50, codeName: 'MaxTimeMSExpired', errmsg: 'operation exceeded time limit' }),
      );
      // S2 interim: `unknown` + a listed row is uncertain (I9): attached and logged, not owned.
      expect(result).toBeUndefined();
      expect(logs.warn.some(m => m.includes('may have been created by Mastra'))).toBe(true);
      expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
    });
  });
  describe('provisioning with ids (S2)', () => {
    let a: MongoDBVector;
    let b: MongoDBVector;
    const colls: string[] = [];
    const entry = (name: string) => db.collection(REGISTRY).findOne({ _id: name as any });
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
    });

    afterAll(async () => {
      for (const c of colls) {
        await db.collection(REGISTRY).deleteMany({ $or: [{ _id: c as any }, { collectionName: c }] });
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

    /** Run `fn` with `hooks` set on `stores`, clearing them afterwards. */
    async function withHooks<T>(stores: MongoDBVector[], hooks: Document, fn: () => Promise<T>): Promise<T> {
      for (const s of stores) (s as any).testHooks = hooks;
      try {
        return await fn();
      } finally {
        for (const s of stores) (s as any).testHooks = undefined;
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
            phase === 'P3a' ? [] : phase === 'P5' ? [{ name, id: OLD, status: 'READY' }] : undefined,
          createSearchIndexesCommand: async () => ({ ok: 1, indexesCreated: [{ id: OLD, name: vec }] }),
        },
        () => createByo(a, coll),
      );
      const e = await entry(coll);
      expect(e?.ownsVectorIndex).not.toBe(true);
      expect(e?.indexIds ?? []).toEqual([]);
      expect(logs.warn.some(m => m.includes(vec) && m.includes(OLD))).toBe(true);
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

    describe('S2-UNKNOWN', () => {
      it('(a) a lost response with nothing listed fails as pending and keeps the registration', async () => {
        const coll = await byoColl('sunk_a');
        const vec = `${coll}_vector_index`;
        const err = await withHooks([a], { createSearchIndexesCommand: unknownCreateMode({ perform: false }) }, () =>
          createByo(a, coll).catch(e => e),
        );
        expect(err?.id).toBe(createVectorErrorId('MONGODB', 'CREATE_INDEX', 'FAILED'));
        expect(err?.message).toBe(
          `The create of search index "${vec}" on "${coll}" may or may not have reached Atlas. Retry.`,
        );
        expect(await entry(coll)).not.toBeNull();
        expect(await searchIndexNames(db, coll)).toEqual([]);
      });

      it('(b) a lost response with the index listed attaches, not owned, with a warning', async () => {
        const coll = await byoColl('sunk_b');
        const logs = captureLogs(a);
        await withHooks([a], { createSearchIndexesCommand: unknownCreateMode({ perform: true }) }, () =>
          createByo(a, coll),
        );
        expect((await entry(coll))?.ownsVectorIndex).not.toBe(true);
        expect(logs.warn.some(m => m.includes('may have been created by Mastra'))).toBe(true);
      });
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
      });
    });
  });
});
