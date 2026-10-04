import { randomUUID } from 'node:crypto';
import { TABLE_OBSERVATIONAL_MEMORY } from '@mastra/core/storage';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import oracledb from 'oracledb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { OracleStore } from '../..';
import { createObservationalMemoryConcurrencyTests } from '../../../../../_test-utils/src';
import { OraclePoolManager } from '../../../shared/connection';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const runIntegration = process.env.RUN_ORACLE_STORAGE_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

const connection = {
  user: process.env.ORACLE_DATABASE_USER ?? 'mastra_test',
  password: process.env.ORACLE_DATABASE_PASSWORD ?? 'mastra_test_password',
  connectString: process.env.ORACLE_DATABASE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1',
};
// A dedicated migration ledger, so these stores' memory-schema migration state is independent
// of the shared suite's.
const migrationTableName = 'ORACLE_OM_LIFECYCLE_MIGRATIONS';
const omTable = TABLE_OBSERVATIONAL_MEMORY.toUpperCase();

/** Each OracleStore gets its own pool, so two stores stand in for two processes. */
async function newStore(id: string) {
  const poolManager = new OraclePoolManager(connection);
  const store = new OracleStore({ id, poolManager, skipDefaultIndexes: true, migrationTableName });
  await store.init();
  const memory = (await store.getStore('memory'))! as MemoryStorage;
  return { memory, close: () => poolManager.close() };
}

if (runIntegration) {
  createObservationalMemoryConcurrencyTests({
    label: 'OracleDB (two pools)',
    timeout: 300_000,
    createStores: async () => {
      const a = await newStore(`om-life-a-${randomUUID()}`);
      const b = await newStore(`om-life-b-${randomUUID()}`);
      return {
        a: a.memory,
        b: b.memory,
        cleanup: async () => {
          await Promise.all([a.close(), b.close()]);
        },
      };
    },
  });
}

describeIntegration('OracleDB observational memory supersededBy upgrade, backfill, and row locks', () => {
  const closers: (() => Promise<void>)[] = [];
  let sql: oracledb.Connection;
  let memory: MemoryStorage;

  const open = async (label: string) => {
    const store = await newStore(`om-upgrade-${label}-${randomUUID()}`);
    closers.push(store.close);
    return store.memory;
  };

  beforeAll(async () => {
    memory = await open('initial');
    sql = await oracledb.getConnection(connection);
  });

  afterAll(async () => {
    await sql?.close().catch(() => {});
    await Promise.all(closers.map(close => close().catch(() => {})));
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
  const hasColumn = async () =>
    (
      await sql.execute(
        `SELECT 1 FROM user_tab_columns WHERE table_name = :tableName AND column_name = 'supersededBy'`,
        { tableName: omTable },
      )
    ).rows!.length === 1;

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
    // Pre-M3 shape: no supersededBy column, and the ledger records the previous memory schema.
    await sql.execute(`ALTER TABLE ${omTable} DROP COLUMN "supersededBy"`);
    await sql.execute(
      `UPDATE ${migrationTableName} SET checksum = 'PRE_M3' WHERE id = 'R001_MEMORY_SCHEMA'`,
      {},
      {
        autoCommit: true,
      },
    );
    expect(await hasColumn()).toBe(false);

    memory = await open('upgraded');
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

    await open('again');
    expect(await supersededByIds([chain, dup])).toEqual(expected);
  });

  it('fences rows left live by an older adapter on every start, not only on schema upgrades', async () => {
    const key = { threadId: `late-${randomUUID()}`, resourceId: 'late-resource' };
    // Written after the schema migration ran, as an older process would: two live generations.
    await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-0`, 0, at(0)));
    await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-1`, 1, at(1000)));
    expect(Object.values(await supersededByIds([key]))).toEqual([null, null]);

    await open('restart');
    expect(await supersededByIds([key])).toEqual({
      [`${key.threadId}-0`]: `${key.threadId}-1`,
      [`${key.threadId}-1`]: null,
    });
  });

  it('a backfill racing a rollover always leaves exactly one live record', async () => {
    for (let i = 0; i < 25; i++) {
      const key = { threadId: `race-${randomUUID()}`, resourceId: 'race-resource' };
      // Two live rows, as left by a pre-M3 process: generation 0 was never marked superseded.
      await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-0`, 0, at(0)));
      await memory.insertObservationalMemoryRecord(row(key, `${key.threadId}-1`, 1, at(1000)));
      const snapshot = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(snapshot.id).toBe(`${key.threadId}-1`);

      await Promise.all([
        open(`race-${i}`),
        memory.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 1 }),
      ]);

      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.generationCount).toBe(2);
      const live = (await memory.getObservationalMemoryHistory(key.threadId, key.resourceId, 100)).filter(
        r => !r.supersededBy,
      );
      expect(live.map(r => r.id)).toEqual([head.id]);
    }
  });

  it('activation waits for a row lock held by another writer and then sees its write', async () => {
    const key = { threadId: `lock-${randomUUID()}`, resourceId: 'lock-resource', scope: 'thread' as const, config: {} };
    const record = await memory.initializeObservationalMemory(key);
    await memory.updateBufferedObservations({
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

    const holder = await oracledb.getConnection(connection);
    try {
      await holder.execute(`SELECT id FROM ${omTable} WHERE id = :id FOR UPDATE`, { id: record.id });
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
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(settled).toBe(false);
      // The lock holder appends a chunk; activation must see it once the lock is released.
      const stored = await holder.execute<{ CHUNKS: string }>(
        `SELECT JSON_SERIALIZE("bufferedObservationChunks" RETURNING CLOB) AS chunks FROM ${omTable} WHERE id = :id`,
        { id: record.id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { CHUNKS: { type: oracledb.STRING } } },
      );
      const chunks = JSON.stringify([
        ...(JSON.parse(stored.rows![0]!.CHUNKS) as unknown[]),
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
      await holder.execute(`UPDATE ${omTable} SET "bufferedObservationChunks" = JSON(:chunks) WHERE id = :id`, {
        chunks,
        id: record.id,
      });
      await holder.commit();
      const result = await swap;
      expect(result.activatedCycleIds).toEqual(['cycle-one', 'cycle-two']);
    } finally {
      await holder.close();
    }
  });

  it('stores timestamps exactly regardless of the host time zone (DST-shifted instants)', async () => {
    // A January instant while the session offset was captured in a different DST period used
    // to be stored an hour early when bound as TIMESTAMP WITH LOCAL TIME ZONE.
    const key = { threadId: `tz-${randomUUID()}`, resourceId: 'tz-resource', scope: 'thread' as const, config: {} };
    const record = await memory.initializeObservationalMemory(key);
    const winter = new Date('2024-01-15T10:00:00.000Z');
    const summer = new Date('2024-07-15T10:00:00.000Z');
    await memory.updateActiveObservations({
      id: record.id,
      observations: '- winter',
      tokenCount: 1,
      lastObservedAt: winter,
    });
    await memory.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: 'cycle-summer',
        observations: '- summer',
        tokenCount: 1,
        messageIds: ['m-summer'],
        messageTokens: 1,
        lastObservedAt: summer,
      },
      lastBufferedAtTime: summer,
    });
    const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
    expect(head.lastObservedAt?.toISOString()).toBe(winter.toISOString());
    expect(head.lastBufferedAtTime?.toISOString()).toBe(summer.toISOString());
    const next = await memory.createReflectionGeneration({ currentRecord: head, reflection: '- r', tokenCount: 1 });
    const carried = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
    expect(carried.id).toBe(next.id);
    expect(carried.lastObservedAt?.toISOString()).toBe(winter.toISOString());
    expect(carried.lastBufferedAtTime?.toISOString()).toBe(summer.toISOString());
  });
});
