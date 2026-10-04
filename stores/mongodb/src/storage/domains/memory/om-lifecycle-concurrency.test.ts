import { randomUUID } from 'node:crypto';
import { createObservationalMemoryConcurrencyTests } from '@internal/storage-test-utils';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { Collection, MongoClient } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoDBStore } from '../../index';

/**
 * Runs on whatever topology MONGODB_URL points at: standalone (default, localhost:27017) or the
 * replica set (`pnpm pretest:fidelity`, localhost:27019). The adapter uses only single-document
 * conditional updates, so both must pass.
 */
const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const OM = 'mastra_observational_memory';

const newDbName = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function openStore(dbName: string, id: string, options: { skipDefaultIndexes?: boolean } = {}) {
  const store = new MongoDBStore({ id, uri: URI, dbName, ...options });
  await store.init();
  return { store, memory: (await store.getStore('memory'))! };
}

createObservationalMemoryConcurrencyTests({
  label: 'MongoDB (two clients)',
  createStores: async () => {
    const dbName = newDbName('om_life');
    const a = await openStore(dbName, 'om-life-a');
    const b = await openStore(dbName, 'om-life-b');
    return {
      a: a.memory,
      b: b.memory,
      cleanup: async () => {
        const client = await MongoClient.connect(URI);
        await client.db(dbName).dropDatabase();
        await client.close();
        await Promise.all([a.store.close(), b.store.close()].map(p => p.catch(() => {})));
      },
    };
  },
});

describe('MongoDB observational memory supersededBy, rollover recovery, and appends', () => {
  const dbName = newDbName('om_mongo');
  let client: MongoClient;
  let raw: Collection;
  let stores: MongoDBStore[] = [];
  let a: MemoryStorage;
  let b: MemoryStorage;

  const newStore = async (options: { skipDefaultIndexes?: boolean } = {}) => {
    const opened = await openStore(dbName, `om-mongo-${stores.length}`, options);
    stores.push(opened.store);
    return opened.memory;
  };

  beforeAll(async () => {
    client = await MongoClient.connect(URI);
    a = await newStore();
    b = await newStore();
    raw = client.db(dbName).collection(OM);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
    await Promise.all(stores.map(store => store.close().catch(() => {})));
  });

  const base = Date.parse('2026-01-10T12:00:00.000Z');
  const at = (ms: number) => new Date(base + ms);
  const chunk = (cycleId: string, lastObservedAtMs: number, observations = `- ${cycleId}`) => ({
    cycleId,
    observations,
    tokenCount: 1,
    messageIds: [`msg-${cycleId}`],
    messageTokens: 100,
    lastObservedAt: at(lastObservedAtMs),
  });
  const newKey = (prefix: string) => ({
    threadId: `${prefix}-${randomUUID()}`,
    resourceId: 'resource',
    scope: 'thread' as const,
    config: {},
  });
  const cycleIds = (doc: any) =>
    (Array.isArray(doc?.bufferedObservationChunks) ? doc.bufferedObservationChunks : []).map((c: any) => c.cycleId);

  /** Legacy (pre-M3) document: no supersededBy, optionally missing other fields. */
  const legacyDoc = (threadId: string, id: string, generationCount: number, createdAtMs: number) => ({
    id,
    lookupKey: `thread:${threadId}`,
    scope: 'thread',
    resourceId: 'resource',
    threadId,
    activeObservations: `- ${id}`,
    originType: generationCount === 0 ? 'initial' : 'reflection',
    config: {},
    generationCount,
    pendingMessageTokens: 0,
    totalTokensObserved: 0,
    observationTokenCount: 0,
    isObserving: false,
    isReflecting: false,
    createdAt: at(createdAtMs),
    updatedAt: at(createdAtMs),
  });

  /** Apply a rollover fence directly, as if the process crashed right after it. */
  const fence = async (record: ObservationalMemoryRecord, reflection = '- reflected') => {
    const newId = randomUUID();
    await raw.updateOne(
      { id: record.id },
      {
        $set: {
          supersededBy: newId,
          pendingSuccessor: {
            newId,
            mode: 'equal',
            reflection,
            tokenCount: 7,
            snapTextLength: record.activeObservations.length,
            snapObservationTokenCount: record.observationTokenCount,
            clearBufferedReflection: false,
            createdAt: new Date(),
          },
        },
      },
    );
    return newId;
  };

  /** A record with two chunks, flags, and counters set. */
  const seeded = async (prefix: string) => {
    const key = newKey(prefix);
    const record = await a.initializeObservationalMemory(key);
    await a.updateBufferedObservations({ id: record.id, chunk: chunk('one', 101), lastBufferedAtTime: at(101) });
    await a.updateBufferedObservations({
      id: record.id,
      chunk: chunk('two', 201, '<observation-group id="g-two"> two'),
      lastBufferedAtTime: at(201),
    });
    await a.setPendingMessageTokens(record.id, 321);
    await a.setBufferingObservationFlag(record.id, true, 654);
    return { key, record: (await a.getObservationalMemory(key.threadId, key.resourceId))! };
  };

  it('adds supersededBy to legacy documents and leaves only the canonical head live (idempotently)', async () => {
    const chain = `chain-${randomUUID()}`;
    const dup = `dup-${randomUUID()}`;
    await raw.insertMany([
      legacyDoc(chain, `${chain}-0`, 0, 0),
      legacyDoc(chain, `${chain}-1`, 1, 1000),
      legacyDoc(chain, `${chain}-2`, 2, 2000),
      legacyDoc(dup, `${dup}-0`, 0, 0),
      legacyDoc(dup, `${dup}-1-late`, 1, 2000),
      legacyDoc(dup, `${dup}-1-early`, 1, 1000),
    ]);
    const state = async () =>
      Object.fromEntries(
        (await raw.find({ lookupKey: { $in: [`thread:${chain}`, `thread:${dup}`] } }).toArray()).map(d => [
          d.id,
          d.supersededBy ?? null,
        ]),
      );

    await newStore();
    const expected = {
      [`${chain}-0`]: `${chain}-2`,
      [`${chain}-1`]: `${chain}-2`,
      [`${chain}-2`]: null,
      [`${dup}-0`]: `${dup}-1-early`,
      [`${dup}-1-late`]: `${dup}-1-early`,
      [`${dup}-1-early`]: null,
    };
    expect(await state()).toEqual(expected);
    expect((await a.getObservationalMemory(dup, 'resource'))!.id).toBe(`${dup}-1-early`);

    await newStore();
    expect(await state()).toEqual(expected);
  });

  it('a backfill racing a rollover always leaves exactly one live record', async () => {
    for (let i = 0; i < 25; i++) {
      const threadId = `race-${randomUUID()}`;
      await raw.insertMany([legacyDoc(threadId, `${threadId}-0`, 0, 0), legacyDoc(threadId, `${threadId}-1`, 1, 1000)]);
      const snapshot = (await a.getObservationalMemory(threadId, 'resource'))!;
      expect(snapshot.id).toBe(`${threadId}-1`);

      const backfiller = new MongoDBStore({ id: `om-race-${i}`, uri: URI, dbName });
      stores.push(backfiller);
      await Promise.all([
        backfiller.init(),
        a.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 1 }),
      ]);

      const head = (await a.getObservationalMemory(threadId, 'resource'))!;
      expect(head.generationCount).toBe(2);
      const live = await raw.find({ lookupKey: `thread:${threadId}`, supersededBy: null }).toArray();
      expect(live.map(d => d.id)).toEqual([head.id]);
    }
  }, 120_000);

  it('a crash after the fence is rolled forward by the next read from another store', async () => {
    const { key, record } = await seeded('crash');
    const newId = await fence(record);

    const head = (await b.getObservationalMemory(key.threadId, key.resourceId))!;
    expect(head.id).toBe(newId);
    expect(head.generationCount).toBe(record.generationCount + 1);
    expect(head.activeObservations).toBe('- reflected');
    expect(head.observationTokenCount).toBe(7);
    expect(head.bufferedObservationChunks?.map(c => c.cycleId)).toEqual(['one', 'two']);
    expect(head.lastBufferedAtTime?.toISOString()).toBe(at(201).toISOString());
    expect(head.pendingMessageTokens).toBe(321);
    expect(head.isBufferingObservation).toBe(true);
    expect(head.lastBufferedAtTokens).toBe(654);
    expect(head.supersededBy ?? null).toBeNull();
    expect(head).not.toHaveProperty('pendingSuccessor');

    const old = await raw.findOne({ id: record.id });
    expect(old!.supersededBy).toBe(newId);
    expect(old!.bufferedObservationChunks).toEqual([]);
    expect(old).not.toHaveProperty('pendingSuccessor');
  });

  it('concurrent roll-forwards from two stores create one successor', async () => {
    for (let i = 0; i < 10; i++) {
      const { key, record } = await seeded(`rollforward-${i}`);
      const newId = await fence(record);
      const [fromA, fromB] = await Promise.all([
        a.getObservationalMemory(key.threadId, key.resourceId),
        b.getObservationalMemory(key.threadId, key.resourceId),
      ]);
      expect(fromA!.id).toBe(newId);
      expect(fromB!.id).toBe(newId);
      expect(await raw.countDocuments({ id: newId })).toBe(1);
      expect(cycleIds(await raw.findOne({ id: newId }))).toEqual(['one', 'two']);
    }
  });

  it('writes aimed at a fenced record (rollover in flight) land on the successor', async () => {
    const { key, record } = await seeded('fenced-write');
    const newId = await fence(record);
    expect(await b.updateBufferedObservations({ id: record.id, chunk: chunk('late', 301) })).toEqual({
      persisted: true,
      recordId: newId,
    });
    await b.setPendingMessageTokens(record.id, 999);
    expect(
      (
        await b.swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 1000,
        })
      ).retired,
    ).toBe(true);
    const head = (await a.getObservationalMemory(key.threadId, key.resourceId))!;
    expect(head.bufferedObservationChunks?.map(c => c.cycleId)).toEqual(['one', 'two', 'late']);
    expect(head.pendingMessageTokens).toBe(999);
  });

  it('a crash after the successor insert but before cleanup is finished by the next init', async () => {
    const { key, record } = await seeded('cleanup');
    const newId = await fence(record);
    const old = await raw.findOne({ id: record.id });
    // Successor inserted, cleanup never ran.
    const { _id, pendingSuccessor, ...carried } = old!;
    expect(pendingSuccessor).toBeDefined();
    expect(_id).toBeDefined();
    await raw.insertOne({
      ...carried,
      id: newId,
      generationCount: old!.generationCount + 1,
      supersededBy: null,
      createdAt: new Date(),
    });
    expect(await a.getObservationalMemoryHistory(key.threadId, key.resourceId, 10, { groupId: 'g-two' })).toHaveLength(
      2,
    );

    await newStore();
    const cleaned = await raw.findOne({ id: record.id });
    expect(cleaned!.bufferedObservationChunks).toEqual([]);
    expect(cleaned).not.toHaveProperty('pendingSuccessor');
    const found = await a.getObservationalMemoryHistory(key.threadId, key.resourceId, 10, { groupId: 'g-two' });
    expect(found.map(r => r.id)).toEqual([newId]);
  });

  it('a legacy document missing bufferedObservationChunks and supersededBy rolls over and accepts appends', async () => {
    const threadId = `legacy-${randomUUID()}`;
    await raw.insertOne(legacyDoc(threadId, `${threadId}-0`, 0, 0));
    const record = (await a.getObservationalMemory(threadId, 'resource'))!;
    expect(record.supersededBy ?? null).toBeNull();
    expect(await a.updateBufferedObservations({ id: record.id, chunk: chunk('first', 101) })).toEqual({
      persisted: true,
      recordId: record.id,
    });
    const nextId = randomUUID();
    const next = await a.createReflectionGeneration({
      currentRecord: record,
      reflection: '- reflected',
      tokenCount: 1,
      newRecordId: nextId,
    });
    expect(next.id).toBe(nextId);
    expect(next.bufferedObservationChunks?.map(c => c.cycleId)).toEqual(['first']);
    expect(await a.updateBufferedObservations({ id: record.id, chunk: chunk('second', 201) })).toEqual({
      persisted: true,
      recordId: nextId,
    });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['an object', {}],
    ['a string', 'not-an-array'],
  ])('accepts an append when bufferedObservationChunks is %s', async (_label, value) => {
    const threadId = `shape-${randomUUID()}`;
    const doc: Record<string, unknown> = legacyDoc(threadId, `${threadId}-0`, 0, 0);
    if (value !== undefined) doc.bufferedObservationChunks = value;
    await raw.insertOne(doc);
    expect(await a.updateBufferedObservations({ id: `${threadId}-0`, chunk: chunk('only', 101) })).toEqual({
      persisted: true,
      recordId: `${threadId}-0`,
    });
    expect(cycleIds(await raw.findOne({ id: `${threadId}-0` }))).toEqual(['only']);
  });

  it('stores chunk text starting with $ literally', async () => {
    const record = await a.initializeObservationalMemory(newKey('dollar'));
    const dollar = { ...chunk('dollar', 101, '$activeObservations'), messageIds: ['$lookupKey'] };
    await a.updateBufferedObservations({ id: record.id, chunk: dollar });
    const stored = (await raw.findOne({ id: record.id }))!.bufferedObservationChunks[0];
    expect(stored.observations).toBe('$activeObservations');
    expect(stored.messageIds).toEqual(['$lookupKey']);
  });

  it('simultaneous identical appends from two stores store the chunk once', async () => {
    for (let i = 0; i < 25; i++) {
      const record = await a.initializeObservationalMemory(newKey(`dup-append-${i}`));
      const same = chunk(`same-${i}`, 101);
      const results = await Promise.all([
        a.updateBufferedObservations({ id: record.id, chunk: same }),
        b.updateBufferedObservations({ id: record.id, chunk: same }),
      ]);
      expect(results.filter(r => r?.persisted)).toHaveLength(1);
      expect(cycleIds(await raw.findOne({ id: record.id }))).toEqual([same.cycleId]);
    }
  });

  /**
   * Run `during` from store B right before store A's append update reaches the server.
   * Only the append's conditional update carries a `bufferedObservationChunks.cycleId` predicate.
   */
  const interceptAppend = (during: () => Promise<unknown>) => {
    const original = Collection.prototype.updateOne;
    let fired = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(async function (
      this: Collection,
      ...args: Parameters<Collection['updateOne']>
    ) {
      if (!fired && args[0] && 'bufferedObservationChunks.cycleId' in (args[0] as object)) {
        fired = true;
        await during();
      }
      return original.apply(this, args);
    } as any);
  };

  it('skips the chunk when the cursor moves past all of its messages between the read and the write', async () => {
    const record = await a.initializeObservationalMemory(newKey('cursor-past'));
    const c = chunk('covered', 101); // max message time = 100ms
    interceptAppend(() =>
      b.updateActiveObservations({ id: record.id, observations: '- synced', tokenCount: 1, lastObservedAt: at(100) }),
    );
    expect(await a.updateBufferedObservations({ id: record.id, chunk: c })).toEqual({
      persisted: false,
      recordId: record.id,
    });
    expect(cycleIds(await raw.findOne({ id: record.id }))).toEqual([]);
  });

  it('stores the chunk when the cursor stops just before its last message', async () => {
    const record = await a.initializeObservationalMemory(newKey('cursor-before'));
    const c = chunk('partial', 101);
    interceptAppend(() =>
      b.updateActiveObservations({ id: record.id, observations: '- synced', tokenCount: 1, lastObservedAt: at(99) }),
    );
    expect(await a.updateBufferedObservations({ id: record.id, chunk: c })).toEqual({
      persisted: true,
      recordId: record.id,
    });
    expect(cycleIds(await raw.findOne({ id: record.id }))).toEqual(['partial']);
  });

  it('skips the chunk when another store appends the same cycle between the read and the write', async () => {
    const record = await a.initializeObservationalMemory(newKey('cycle-race'));
    const c = chunk('raced', 101);
    interceptAppend(() => b.updateBufferedObservations({ id: record.id, chunk: c }));
    expect(await a.updateBufferedObservations({ id: record.id, chunk: c })).toEqual({
      persisted: false,
      recordId: record.id,
    });
    expect(cycleIds(await raw.findOne({ id: record.id }))).toEqual(['raced']);
  });

  it('warns when the unique id index is missing (skipDefaultIndexes)', async () => {
    const noIndexDb = newDbName('om_noidx');
    const opened = await openStore(noIndexDb, 'om-noidx', { skipDefaultIndexes: true });
    stores.push(opened.store);
    const warn = vi.fn();
    opened.memory.__setLogger({ warn, info: vi.fn(), debug: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any);
    await opened.memory.init();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no unique index on { id: 1 }'));
    await client.db(noIndexDb).dropDatabase();
  });
});
