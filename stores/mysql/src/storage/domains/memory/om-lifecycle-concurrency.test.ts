import { randomUUID } from 'node:crypto';
import { createObservationalMemoryConcurrencyTests } from '@internal/storage-test-utils';
import type { MemoryStorage } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MySQLStore } from '../../index';
import type { MySQLStoreConfig } from '../../index';

/**
 * Every test gets its own disposable database (created with the test container's root account),
 * so dropping the supersededBy column for the upgrade test cannot disturb other test files.
 */
const ROOT_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_ROOT_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'root',
};

const OM_TABLE = '`mastra_observational_memory`';

async function createDatabase(prefix: string) {
  const database = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = createPool({ ...ROOT_CONFIG, connectionLimit: 1 });
  await admin.query(`CREATE DATABASE \`${database}\``);
  await admin.end();
  const config: MySQLStoreConfig = { ...ROOT_CONFIG, database, max: 10 };
  return {
    config,
    pool: createPool({ ...ROOT_CONFIG, database, connectionLimit: 4, dateStrings: true }),
    drop: async () => {
      const dropper = createPool({ ...ROOT_CONFIG, connectionLimit: 1 });
      await dropper.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await dropper.end();
    },
  };
}

async function openStore(config: MySQLStoreConfig, id: string) {
  const store = new MySQLStore({ ...config, id });
  await store.init();
  return { store, memory: (await store.getStore('memory'))! };
}

/** Each MySQLStore has its own pool, so two stores stand in for two processes. */
createObservationalMemoryConcurrencyTests({
  label: 'MySQL (two pools)',
  createStores: async () => {
    const db = await createDatabase('om_life');
    const a = await openStore(db.config, 'om-life-a');
    const b = await openStore(db.config, 'om-life-b');
    return {
      a: a.memory,
      b: b.memory,
      cleanup: async () => {
        await Promise.all([a.store.close(), b.store.close()].map(p => p.catch(() => {})));
        await db.pool.end();
        await db.drop();
      },
    };
  },
});

describe('MySQL observational memory supersededBy upgrade and row locks', () => {
  let db: Awaited<ReturnType<typeof createDatabase>>;
  let pool: Pool;
  let stores: MySQLStore[] = [];
  let memory: MemoryStorage;

  const newStore = async (id = `om-upgrade-${stores.length}`) => {
    const opened = await openStore(db.config, id);
    stores.push(opened.store);
    return opened.memory;
  };

  beforeAll(async () => {
    db = await createDatabase('om_upgrade');
    pool = db.pool;
    memory = await newStore();
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close().catch(() => {})));
    await pool.end();
    await db.drop();
  });

  const at = (ms: number) =>
    new Date(Date.parse('2026-01-10T12:00:00.000Z') + ms).toISOString().slice(0, 23).replace('T', ' ');

  /** Raw insert of an OM row in the pre-M3 shape (no supersededBy value). */
  const insertRow = async (threadId: string, id: string, generationCount: number, createdAtMs: number) => {
    await pool.execute(
      `INSERT INTO ${OM_TABLE} (id, lookupKey, scope, resourceId, threadId, activeObservations, originType, config,
        generationCount, pendingMessageTokens, totalTokensObserved, observationTokenCount, isObserving, isReflecting,
        isBufferingObservation, isBufferingReflection, lastBufferedAtTokens, createdAt, updatedAt)
      VALUES (?, ?, 'thread', 'resource', ?, ?, ?, '{}', ?, 0, 0, 0, false, false, false, false, 0, ?, ?)`,
      [
        id,
        `thread:${threadId}`,
        threadId,
        `- ${id}`,
        generationCount === 0 ? 'initial' : 'reflection',
        generationCount,
        at(createdAtMs),
        at(createdAtMs),
      ],
    );
  };

  const supersededByIds = async (threadIds: string[]) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, supersededBy FROM ${OM_TABLE} WHERE lookupKey IN (?)`,
      [threadIds.map(t => `thread:${t}`)],
    );
    return Object.fromEntries(rows.map(r => [r.id, r.supersededBy ?? null]));
  };

  const hasColumn = async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mastra_observational_memory' AND column_name = 'supersededBy'`,
    );
    return rows.length === 1;
  };

  it('adds the column to a pre-M3 table and leaves only the canonical head live (idempotently)', async () => {
    const chain = `chain-${randomUUID()}`;
    const dup = `dup-${randomUUID()}`;
    // Pre-M3 shape: the table has no supersededBy column.
    await pool.query(`ALTER TABLE ${OM_TABLE} DROP COLUMN supersededBy`);
    expect(await hasColumn()).toBe(false);
    await insertRow(chain, `${chain}-0`, 0, 0);
    await insertRow(chain, `${chain}-1`, 1, 1000);
    await insertRow(chain, `${chain}-2`, 2, 2000);
    await insertRow(dup, `${dup}-0`, 0, 0);
    await insertRow(dup, `${dup}-1-late`, 1, 2000);
    await insertRow(dup, `${dup}-1-early`, 1, 1000);

    memory = await newStore();
    expect(await hasColumn()).toBe(true);

    const expected = {
      [`${chain}-0`]: `${chain}-2`,
      [`${chain}-1`]: `${chain}-2`,
      [`${chain}-2`]: null,
      [`${dup}-0`]: `${dup}-1-early`,
      [`${dup}-1-late`]: `${dup}-1-early`,
      [`${dup}-1-early`]: null,
    };
    expect(await supersededByIds([chain, dup])).toEqual(expected);
    expect((await memory.getObservationalMemory(dup, 'resource'))!.id).toBe(`${dup}-1-early`);

    await newStore();
    expect(await supersededByIds([chain, dup])).toEqual(expected);
  });

  it('a backfill racing a rollover always leaves exactly one live record', async () => {
    for (let i = 0; i < 25; i++) {
      const threadId = `race-${randomUUID()}`;
      // Two live rows, as left by a pre-M3 process: generation 0 was never marked superseded.
      await insertRow(threadId, `${threadId}-0`, 0, 0);
      await insertRow(threadId, `${threadId}-1`, 1, 1000);
      const snapshot = (await memory.getObservationalMemory(threadId, 'resource'))!;
      expect(snapshot.id).toBe(`${threadId}-1`);

      const backfiller = new MySQLStore({ ...db.config, id: `om-race-${i}` });
      stores.push(backfiller);
      await Promise.all([
        backfiller.init(),
        memory.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 1 }),
      ]);

      const head = (await memory.getObservationalMemory(threadId, 'resource'))!;
      expect(head.generationCount).toBe(2);
      const live = Object.entries(await supersededByIds([threadId])).filter(([, by]) => by === null);
      expect(live.map(([id]) => id)).toEqual([head.id]);
    }
  }, 180_000);

  it('activation waits for a row lock held by another writer and then sees its write', async () => {
    const threadId = `lock-${randomUUID()}`;
    const record = await memory.initializeObservationalMemory({
      threadId,
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    const chunk = (cycleId: string, ms: number) => ({
      cycleId,
      observations: `- ${cycleId}`,
      tokenCount: 1,
      messageIds: [cycleId],
      messageTokens: 500,
      lastObservedAt: new Date(Date.parse('2026-01-10T12:00:00.000Z') + ms),
    });
    await memory.updateBufferedObservations({ id: record.id, chunk: chunk('cycle-one', 101) });

    const holder = await pool.getConnection();
    try {
      await holder.beginTransaction();
      const [locked] = await holder.query<RowDataPacket[]>(
        `SELECT bufferedObservationChunks FROM ${OM_TABLE} WHERE id = ? FOR UPDATE`,
        [record.id],
      );
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
      const stored = locked[0]!.bufferedObservationChunks;
      const chunks = [
        ...(typeof stored === 'string' ? JSON.parse(stored) : stored),
        { id: 'ombuf-two', ...chunk('cycle-two', 201), createdAt: new Date().toISOString() },
      ];
      await holder.query(`UPDATE ${OM_TABLE} SET bufferedObservationChunks = ? WHERE id = ?`, [
        JSON.stringify(chunks),
        record.id,
      ]);
      await holder.commit();
      const result = await swap;
      expect(result.activatedCycleIds).toEqual(['cycle-one', 'cycle-two']);
    } finally {
      holder.release();
    }
  });
});
