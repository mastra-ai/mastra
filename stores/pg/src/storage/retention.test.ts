import { createSampleThreadWithParams } from '@internal/storage-test-utils';
import type { StorageThreadType } from '@mastra/core/memory';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TEST_CONFIG } from './test-utils';
import { PostgresStore } from '.';

// A dedicated schema keeps these rows isolated from other PG suites that use
// the default `public` schema against the same test database.
const SCHEMA = `retention_${Math.random().toString(36).slice(2, 8)}`;

const DAY = 24 * 60 * 60 * 1000;

function newStore(retention?: PostgresStore['retention']) {
  return new PostgresStore({ ...TEST_CONFIG, schemaName: SCHEMA, retention } as any);
}

async function seedThread(store: PostgresStore, id: string, ageDays: number): Promise<StorageThreadType> {
  const at = new Date(Date.now() - ageDays * DAY);
  const memory = store.stores.memory!;
  const thread = createSampleThreadWithParams(id, `resource-${id}`, at, at) as StorageThreadType;
  await memory.saveThread({ thread });
  return thread;
}

async function threadIds(store: PostgresStore): Promise<string[]> {
  const memory = store.stores.memory!;
  const { threads } = await memory.listThreads({ perPage: false });
  return threads.map(t => t.id).sort();
}

describe('PG retention', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = newStore();
    await store.init();
  });

  afterAll(async () => {
    try {
      await store.db.none(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    } catch {}
    try {
      await store.close();
    } catch {}
  });

  beforeEach(async () => {
    // Fresh state per test — clear the memory tables in cascade-safe order.
    await store.stores.memory!.dangerouslyClearAll();
  });

  describe('prune()', () => {
    it('deletes rows older than maxAge and keeps newer ones', async () => {
      await seedThread(store, 'old-1', 40);
      await seedThread(store, 'old-2', 40);
      await seedThread(store, 'new-1', 5);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'memory', table: 'mastra_threads', done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await threadIds(store)).toEqual(['new-1']);
    });

    it('keeps a row at the cutoff and deletes one past it (strict <)', async () => {
      await seedThread(store, 'boundary-older', 31);
      await seedThread(store, 'boundary-newer', 29);

      await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(await threadIds(store)).toEqual(['boundary-newer']);
    });

    it('leaves unset tables untouched (unset = keep forever)', async () => {
      await seedThread(store, 'old-1', 90);

      const results = await store.stores.memory!.prune({});
      expect(results).toEqual([]);
      expect(await threadIds(store)).toEqual(['old-1']);
    });

    it('deletes across multiple batches when over batchSize', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 2 } });

      expect(results[0]!.deleted).toBe(5);
      expect(results[0]!.done).toBe(true);
      expect(await threadIds(store)).toEqual([]);
    });

    it('is bounded and resumable via maxRows', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const first = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { maxRows: 2 });
      expect(first[0]!.deleted).toBe(2);
      expect(first[0]!.done).toBe(false);
      expect((await threadIds(store)).length).toBe(3);

      const second = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });
      expect(second[0]!.deleted).toBe(3);
      expect(second[0]!.done).toBe(true);
      expect(await threadIds(store)).toEqual([]);
    });

    it('is bounded by maxBatches', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 1 } }, { maxBatches: 2 });

      expect(results[0]!.deleted).toBe(2);
      expect(results[0]!.done).toBe(false);
      expect((await threadIds(store)).length).toBe(3);
    });

    it('stops on a pre-aborted signal and reports done:false', async () => {
      for (let i = 0; i < 3; i++) await seedThread(store, `old-${i}`, 40);

      const controller = new AbortController();
      controller.abort();

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { signal: controller.signal });

      expect(results[0]).toMatchObject({ deleted: 0, done: false });
      expect((await threadIds(store)).length).toBe(3);
    });

    it('sweeps orphaned semantic-recall vector rows when pruning messages', async () => {
      // Minimal stand-in for the default PgVector `memory_messages` table.
      await store.db.none(
        `CREATE TABLE IF NOT EXISTS "${SCHEMA}"."memory_messages" ("id" TEXT PRIMARY KEY, "metadata" JSONB)`,
      );
      try {
        const oldAt = new Date(Date.now() - 40 * DAY).toISOString();
        const newAt = new Date().toISOString();
        await store.db.none(
          `INSERT INTO "${SCHEMA}"."mastra_messages" ("id", "thread_id", "content", "role", "type", "createdAt", "createdAtZ") VALUES ('msg-old', 't-1', '{}', 'user', 'v2', $1::timestamp, $1::timestamptz), ('msg-new', 't-1', '{}', 'user', 'v2', $2::timestamp, $2::timestamptz)`,
          [oldAt, newAt],
        );
        await store.db.none(
          `INSERT INTO "${SCHEMA}"."memory_messages" ("id", "metadata") VALUES ('vec-old', '{"message_id": "msg-old"}'), ('vec-new', '{"message_id": "msg-new"}'), ('vec-other', '{"foo": "bar"}')`,
        );

        await store.stores.memory!.prune({ messages: { maxAge: '30d' } });

        const remaining = await store.db.manyOrNone<{ id: string }>(
          `SELECT "id" FROM "${SCHEMA}"."memory_messages" ORDER BY "id"`,
        );
        // vec-old is orphaned by the prune and swept; the live message's
        // embedding and rows without message_id metadata are untouched.
        expect(remaining.map(r => r.id)).toEqual(['vec-new', 'vec-other']);
      } finally {
        await store.db.none(`DROP TABLE IF EXISTS "${SCHEMA}"."memory_messages"`);
      }
    });
  });

  describe('composite prune()', () => {
    it('routes per-table policies to the memory domain via retention config', async () => {
      const configured = newStore({ memory: { threads: { maxAge: '30d' } } });
      await configured.init();
      try {
        await configured.stores.memory!.dangerouslyClearAll();
        await seedThread(configured, 'old-1', 40);
        await seedThread(configured, 'new-1', 5);

        const results = await configured.prune();

        expect(results.map(r => r.table)).toContain('mastra_threads');
        expect(await threadIds(configured)).toEqual(['new-1']);
      } finally {
        await configured.close().catch(() => {});
      }
    });

    it('is a no-op returning [] when no retention is configured', async () => {
      await seedThread(store, 'old-1', 90);
      expect(await store.prune()).toEqual([]);
      expect(await threadIds(store)).toEqual(['old-1']);
    });
  });

  // schedules.triggers is anchored on `actual_fire_at`, a bigint epoch-ms column,
  // so the cutoff is compared numerically rather than as a timestamptz.
  describe('schedules (epoch-ms anchor)', () => {
    beforeEach(async () => {
      await store.stores.schedules!.dangerouslyClearAll();
    });

    async function seedTrigger(id: string, ageDays: number) {
      const fireAt = Date.now() - ageDays * DAY;
      await store.stores.schedules!.recordTrigger({
        id,
        scheduleId: 'sched-1',
        runId: `run-${id}`,
        scheduledFireAt: fireAt,
        actualFireAt: fireAt,
        outcome: 'succeeded',
      });
    }

    async function triggerIds(): Promise<string[]> {
      const triggers = await store.stores.schedules!.listTriggers('sched-1');
      return triggers.map(t => t.id!).sort();
    }

    it('deletes fire history older than maxAge using numeric epoch comparison', async () => {
      await seedTrigger('old-1', 40);
      await seedTrigger('old-2', 40);
      await seedTrigger('new-1', 5);

      const results = await store.stores.schedules!.prune({ triggers: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'schedules', table: 'mastra_schedule_triggers', done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await triggerIds()).toEqual(['new-1']);
    });

    it('leaves fire history untouched when the triggers policy is unset', async () => {
      await seedTrigger('old-1', 90);
      expect(await store.stores.schedules!.prune({})).toEqual([]);
      expect(await triggerIds()).toEqual(['old-1']);
    });
  });

  // Experiments prune as whole units: an aged experiment's result rows are
  // deleted first (cascade), then the experiment, so a run is never left hollow.
  // Seeds rows directly so `completedAt` can be backdated.
  describe('experiments (whole-unit cascade)', () => {
    beforeEach(async () => {
      await store.stores.experiments!.dangerouslyClearAll();
    });

    async function seedExperiment(id: string, completedAgeDays: number | null, resultCount: number) {
      const completedAt = completedAgeDays == null ? null : new Date(Date.now() - completedAgeDays * DAY).toISOString();
      const now = new Date().toISOString();
      await store.db.none(
        `INSERT INTO "${SCHEMA}"."mastra_experiments" ("id", "targetType", "targetId", "status", "totalItems", "succeededCount", "failedCount", "skippedCount", "startedAt", "completedAt", "createdAt", "updatedAt") VALUES ($1, 'agent', 'agent-1', 'completed', $2, 0, 0, 0, $3, $4, $5, $6)`,
        [id, resultCount, now, completedAt, now, now],
      );
      for (let i = 0; i < resultCount; i++) {
        await store.db.none(
          `INSERT INTO "${SCHEMA}"."mastra_experiment_results" ("id", "experimentId", "itemId", "input", "startedAt", "completedAt", "retryCount", "createdAt") VALUES ($1, $2, $3, '{}', $4, $5, 0, $6)`,
          [`${id}-r${i}`, id, `item-${i}`, now, now, now],
        );
      }
    }

    async function counts() {
      const exp = await store.db.oneOrNone<{ c: string }>(`SELECT COUNT(*) AS c FROM "${SCHEMA}"."mastra_experiments"`);
      const res = await store.db.oneOrNone<{ c: string }>(
        `SELECT COUNT(*) AS c FROM "${SCHEMA}"."mastra_experiment_results"`,
      );
      return { experiments: Number(exp!.c), results: Number(res!.c) };
    }

    it('deletes an aged experiment and its results together, keeping running ones', async () => {
      await seedExperiment('old', 40, 3); // completed 40d ago
      await seedExperiment('recent', 5, 2); // completed 5d ago
      await seedExperiment('running', null, 4); // still running (completedAt NULL)

      const results = await store.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      const resultRow = results.find(r => r.table === 'mastra_experiment_results')!;
      const expRow = results.find(r => r.table === 'mastra_experiments')!;
      expect(resultRow.deleted).toBe(3);
      expect(resultRow.done).toBe(true);
      expect(expRow.deleted).toBe(1);
      expect(expRow.done).toBe(true);

      // recent (2 results) + running (4 results) survive; running kept despite age.
      expect(await counts()).toEqual({ experiments: 2, results: 6 });
    });

    it('never leaves an experiment hollow (results deleted only with their parent)', async () => {
      await seedExperiment('old', 40, 5);

      await store.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      // Both the parent and all its children are gone — no orphaned results.
      expect(await counts()).toEqual({ experiments: 0, results: 0 });
    });

    it('removes whole units per batch, so bounds never strip results off surviving runs', async () => {
      await seedExperiment('old-a', 40, 3);
      await seedExperiment('old-b', 41, 3);
      await seedExperiment('old-c', 42, 3);

      // batchSize 1 + maxBatches 2 => exactly two whole experiments removed.
      const results = await store.stores.experiments!.prune(
        { experiments: { maxAge: '30d', batchSize: 1 } },
        { maxBatches: 2 },
      );

      const expRow = results.find(r => r.table === 'mastra_experiments')!;
      expect(expRow.deleted).toBe(2);
      expect(expRow.done).toBe(false);

      // The surviving experiment kept its full result set — never hollow.
      expect(await counts()).toEqual({ experiments: 1, results: 3 });
      const orphans = await store.db.oneOrNone<{ c: string }>(
        `SELECT COUNT(*) AS c FROM "${SCHEMA}"."mastra_experiment_results" r WHERE NOT EXISTS (SELECT 1 FROM "${SCHEMA}"."mastra_experiments" e WHERE e."id" = r."experimentId")`,
      );
      expect(Number(orphans!.c)).toBe(0);
    });
  });

  // Anchor indexes are created lazily on the first prune() call — never at
  // init() — so deployments that don't configure retention pay no index
  // write/disk overhead on their growth tables. Uses its own schema so the
  // shared store's earlier prune calls can't leak indexes into the assertions.
  describe('lazy anchor indexes', () => {
    const LAZY_SCHEMA = `retlazy_${Math.random().toString(36).slice(2, 8)}`;
    let lazyStore: PostgresStore;

    beforeAll(async () => {
      lazyStore = new PostgresStore({ ...TEST_CONFIG, schemaName: LAZY_SCHEMA } as any);
      await lazyStore.init();
    });

    afterAll(async () => {
      try {
        await lazyStore.db.none(`DROP SCHEMA IF EXISTS ${LAZY_SCHEMA} CASCADE`);
      } catch {}
      try {
        await lazyStore.close();
      } catch {}
    });

    async function retentionIndexes(): Promise<string[]> {
      const rows = await lazyStore.db.manyOrNone<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname LIKE '%_retention_idx' ORDER BY indexname`,
        [LAZY_SCHEMA],
      );
      return rows.map(r => r.indexname);
    }

    it('creates no anchor indexes at init, only for pruned tables on first prune', async () => {
      expect(await retentionIndexes()).toEqual([]);

      await lazyStore.stores.memory!.prune({ threads: { maxAge: '30d' } });

      // Only the table with a policy gets its anchor index; messages/resources don't.
      expect(await retentionIndexes()).toEqual([`${LAZY_SCHEMA}_mastra_threads_retention_idx`]);
    });

    it('creates the experiments anchor index lazily via its whole-unit prune path', async () => {
      await lazyStore.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      expect(await retentionIndexes()).toContain(`${LAZY_SCHEMA}_mastra_experiments_retention_idx`);
    });

    // Retention is an explicit opt-in, so its supporting anchor index is not
    // part of the default index set — skipDefaultIndexes must not block it.
    it('creates anchor indexes on prune even with skipDefaultIndexes', async () => {
      const schema = `retskip_${Math.random().toString(36).slice(2, 8)}`;
      const store = new PostgresStore({ ...TEST_CONFIG, schemaName: schema, skipDefaultIndexes: true } as any);
      try {
        await store.init();
        const indexes = async () =>
          (
            await store.db.manyOrNone<{ indexname: string }>(
              `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname LIKE '%_retention_idx'`,
              [schema],
            )
          ).map(r => r.indexname);

        expect(await indexes()).toEqual([]);
        await store.stores.memory!.prune({ threads: { maxAge: '30d' } });
        expect(await indexes()).toEqual([`${schema}_mastra_threads_retention_idx`]);
      } finally {
        try {
          await store.db.none(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        } catch {}
        try {
          await store.close();
        } catch {}
      }
    });
  });
});
