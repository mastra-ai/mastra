import type { CommandStartedEvent, Db, Document, MongoClient, MongoClientOptions } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATLAS_LOCAL_URI,
  DB_NAME,
  captureCommands,
  createRawSearchIndex,
  rawClient,
  seedCollection,
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
        await store.createSearchIndex({ indexName, searchIndexName: 'N1' });
        await store.createSearchIndex({ indexName, searchIndexName: 'N2' });
        await store.claimLegacyIndex({ indexName: legacy });
        await store.deleteIndex({ indexName });
        await store.deleteIndex({ indexName: legacy });

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
});
