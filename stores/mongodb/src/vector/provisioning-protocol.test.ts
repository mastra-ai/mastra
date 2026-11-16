import type { CommandStartedEvent, Db, Document, MongoClient, MongoClientOptions } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  REGISTRY,
  captureCommands,
  createRawSearchIndex,
  deferred,
  rawClient,
  searchIndexNames,
  seedCollection,
  seedRegistry,
  uniqueName,
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
        await db.dropCollection(byo).catch(() => {});
        await db.dropCollection(legacy).catch(() => {});
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
        await db.collection(REGISTRY).deleteOne({ _id: c as any });
        await db.dropCollection(c).catch(() => {});
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
  });
});
