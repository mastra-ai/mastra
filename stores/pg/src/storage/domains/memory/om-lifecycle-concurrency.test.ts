import { randomUUID } from 'node:crypto';
import { createObservationalMemoryConcurrencyTests } from '@internal/storage-test-utils';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString, TEST_CONFIG } from '../../test-utils';

const newSchemaName = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

/** Each PostgresStore has its own pool, so two stores stand in for two processes. */
async function createStorePair(schemaName: string) {
  const stores = [0, 1].map(i => new PostgresStore({ ...TEST_CONFIG, id: `${schemaName}-${i}`, schemaName }));
  await stores[0]!.init();
  await stores[1]!.init();
  const [a, b] = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));
  return { stores, a: a!, b: b! };
}

createObservationalMemoryConcurrencyTests({
  label: 'PostgreSQL (two pools)',
  createStores: async () => {
    const schemaName = newSchemaName('om_life');
    const { stores, a, b } = await createStorePair(schemaName);
    return {
      a,
      b,
      cleanup: async () => {
        await Promise.all(stores.map(store => store.close().catch(() => {})));
        const pool = new Pool({ connectionString });
        await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await pool.end();
      },
    };
  },
});

describe('PostgreSQL observational memory supersededBy upgrade and row locks', () => {
  const schemaName = newSchemaName('om_upgrade');
  const tableName = `"${schemaName}"."mastra_observational_memory"`;
  let pool: Pool;
  let stores: PostgresStore[] = [];
  let memory: MemoryStorage;

  const newStore = async () => {
    const store = new PostgresStore({ ...TEST_CONFIG, id: `${schemaName}-${stores.length}`, schemaName });
    stores.push(store);
    await store.init();
    return (await store.getStore('memory'))!;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    memory = await newStore();
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close().catch(() => {})));
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  const at = (ms: number) => new Date(Date.parse('2026-01-10T12:00:00.000Z') + ms);
  const row = (key: { threadId: string; resourceId: string }, id: string, generationCount: number, createdAt: Date) =>
    ({
      id,
      scope: 'thread',
      threadId: key.threadId,
      resourceId: key.resourceId,
      createdAt,
      updatedAt: createdAt,
      lastObservedAt: undefined,
      originType: generationCount === 0 ? 'initial' : 'reflection',
      generationCount,
      activeObservations: `- ${id}`,
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: {},
      supersededBy: null,
    }) as ObservationalMemoryRecord;
  const supersededByIds = async (keys: { threadId: string; resourceId: string }[]) =>
    Object.fromEntries(
      (
        await Promise.all(keys.map(key => memory.getObservationalMemoryHistory(key.threadId, key.resourceId, 100)))
      ).flatMap(records => records.map(r => [r.id, r.supersededBy])),
    );

  it('adds the column to a pre-M3 table and leaves only the canonical head live (idempotently)', async () => {
    const chain = { threadId: `chain-${randomUUID()}`, resourceId: 'chain-resource' };
    const dup = { threadId: `dup-${randomUUID()}`, resourceId: 'dup-resource' };
    for (const record of [
      row(chain, `${chain.threadId}-0`, 0, at(0)),
      row(chain, `${chain.threadId}-1`, 1, at(1000)),
      row(chain, `${chain.threadId}-2`, 2, at(2000)),
      row(dup, `${dup.threadId}-0`, 0, at(0)),
      row(dup, `${dup.threadId}-1-late`, 1, at(2000)),
      row(dup, `${dup.threadId}-1-early`, 1, at(1000)),
    ]) {
      await memory.insertObservationalMemoryRecord(record);
    }
    // Pre-M3 shape: the table has no supersededBy column.
    await pool.query(`ALTER TABLE ${tableName} DROP COLUMN "supersededBy"`);
    const hasColumn = async () =>
      (
        await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'mastra_observational_memory' AND column_name = 'supersededBy'`,
          [schemaName],
        )
      ).rowCount === 1;
    expect(await hasColumn()).toBe(false);

    memory = await newStore();
    expect(await hasColumn()).toBe(true);

    const expected = {
      [`${chain.threadId}-0`]: `${chain.threadId}-2`,
      [`${chain.threadId}-1`]: `${chain.threadId}-2`,
      [`${chain.threadId}-2`]: null,
      [`${dup.threadId}-0`]: `${dup.threadId}-1-early`,
      [`${dup.threadId}-1-late`]: `${dup.threadId}-1-early`,
      [`${dup.threadId}-1-early`]: null,
    };
    expect(await supersededByIds([chain, dup])).toEqual(expected);
    expect((await memory.getObservationalMemory(dup.threadId, dup.resourceId))!.id).toBe(`${dup.threadId}-1-early`);

    await newStore();
    expect(await supersededByIds([chain, dup])).toEqual(expected);
  });

  it('a backfill racing a rollover always leaves exactly one live record', async () => {
    for (let i = 0; i < 25; i++) {
      const key = { threadId: `race-${randomUUID()}`, resourceId: 'race-resource' };
      // Two live rows, as left by a pre-M3 process: generation 0 was never marked superseded.
      await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-0`, 0, at(0)));
      await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-1`, 1, at(1000)));
      const snapshot = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(snapshot.id).toBe(`${key.threadId}-1`);

      const backfiller = new PostgresStore({ ...TEST_CONFIG, id: `${schemaName}-race-${i}`, schemaName });
      stores.push(backfiller);
      await Promise.all([
        backfiller.init(),
        memory.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 1 }),
      ]);

      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.generationCount).toBe(2);
      const live = (await memory.getObservationalMemoryHistory(key.threadId, key.resourceId, 100)).filter(
        r => !r.supersededBy,
      );
      expect(live.map(r => r.id)).toEqual([head.id]);
    }
  }, 120_000);

  it('activation waits for a row lock held by another writer and then sees its write', async () => {
    const key = { threadId: `lock-${randomUUID()}`, resourceId: 'lock-resource', scope: 'thread' as const, config: {} };
    const record = await memory.initializeObservationalMemory(key);
    await memory.appendBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: 'cycle-one',
        observations: '- one',
        tokenCount: 1,
        messageIds: ['m1'],
        messageTokens: 500,
        lastObservedAt: at(101),
      },
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT id FROM ${tableName} WHERE id = $1 FOR UPDATE`, [record.id]);
      let settled = false;
      const swap = memory
        .swapBufferedToActive({
          id: record.id,
          activationRatio: 1,
          messageTokensThreshold: 1000,
          currentPendingTokens: 1000,
        })
        .finally(() => {
          settled = true;
        });
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(settled).toBe(false);
      // The lock holder appends a chunk; activation must see it once the lock is released.
      const chunks = JSON.stringify([
        ...((await client.query(`SELECT "bufferedObservationChunks" FROM ${tableName} WHERE id = $1`, [record.id]))
          .rows[0].bufferedObservationChunks as unknown[]),
        {
          id: 'ombuf-two',
          cycleId: 'cycle-two',
          observations: '- two',
          tokenCount: 1,
          messageIds: ['m2'],
          messageTokens: 500,
          lastObservedAt: at(201).toISOString(),
          createdAt: at(201).toISOString(),
        },
      ]);
      await client.query(`UPDATE ${tableName} SET "bufferedObservationChunks" = $1::jsonb WHERE id = $2`, [
        chunks,
        record.id,
      ]);
      await client.query('COMMIT');
      const result = await swap;
      expect(result.activatedCycleIds).toEqual(['cycle-one', 'cycle-two']);
    } finally {
      client.release();
    }
  });
});
