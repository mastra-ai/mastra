import { createSampleThreadWithParams } from '@internal/storage-test-utils';
import type { StorageThreadType } from '@mastra/core/memory';
import {
  TABLE_BACKGROUND_TASKS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_EXPERIMENTS,
  TABLE_MEMORY_RUN_FENCES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_THREADS,
  TABLE_WORKFLOW_RUN_OWNERS,
} from '@mastra/core/storage';
import { Collection, MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MongoDBStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
// A dedicated database keeps these rows isolated from the other MongoDB suites
// that share `mastra-test-db` against the same server.
const DB = `mastra-retention-test-${Math.random().toString(36).slice(2, 8)}`;

const DAY = 24 * 60 * 60 * 1000;

function newStore(dbName = DB, extra: Record<string, unknown> = {}) {
  return new MongoDBStore({ id: 'mongodb-retention-test', uri: URI, dbName, ...extra } as any);
}

describe('MongoDB retention', () => {
  let store: MongoDBStore;
  let client: MongoClient;
  const extraDbs: string[] = [];

  beforeAll(async () => {
    client = new MongoClient(URI);
    await client.connect();
    store = newStore();
    await store.init();
  });

  afterAll(async () => {
    for (const name of [DB, ...extraDbs]) {
      try {
        await client.db(name).dropDatabase();
      } catch {}
    }
    await client.close();
    try {
      await store.close();
    } catch {}
  });

  const db = () => client.db(DB);

  async function seedThread(s: MongoDBStore, id: string, ageDays: number): Promise<StorageThreadType> {
    const at = new Date(Date.now() - ageDays * DAY);
    const thread = createSampleThreadWithParams(id, `resource-${id}`, at, at) as StorageThreadType;
    await s.stores.memory!.saveThread({ thread });
    return thread;
  }

  async function threadIds(dbName = DB): Promise<string[]> {
    const docs = await client
      .db(dbName)
      .collection(TABLE_THREADS)
      .find({})
      .project<{ id: string }>({ id: 1 })
      .toArray();
    return docs.map(d => d.id).sort();
  }

  describe('prune()', () => {
    beforeEach(async () => {
      await db().collection(TABLE_THREADS).deleteMany({});
    });

    it('deletes rows older than maxAge and keeps newer ones', async () => {
      await seedThread(store, 'old-1', 40);
      await seedThread(store, 'old-2', 40);
      await seedThread(store, 'new-1', 5);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'memory', table: TABLE_THREADS, done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await threadIds()).toEqual(['new-1']);
    });

    it('keeps a row at the cutoff and deletes one past it (strict <)', async () => {
      await seedThread(store, 'boundary-older', 31);
      await seedThread(store, 'boundary-newer', 29);

      await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(await threadIds()).toEqual(['boundary-newer']);
    });

    it('leaves unset tables untouched (unset = keep forever)', async () => {
      await seedThread(store, 'old-1', 90);

      const results = await store.stores.memory!.prune({});
      expect(results).toEqual([]);
      expect(await threadIds()).toEqual(['old-1']);
    });

    it('deletes across multiple batches when over batchSize', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 2 } });

      expect(results[0]!.deleted).toBe(5);
      expect(results[0]!.done).toBe(true);
      expect(await threadIds()).toEqual([]);
    });

    it('is bounded and resumable via maxRows', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const first = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { maxRows: 2 });
      expect(first[0]!.deleted).toBe(2);
      expect(first[0]!.done).toBe(false);
      expect((await threadIds()).length).toBe(3);

      const second = await store.stores.memory!.prune({ threads: { maxAge: '30d' } });
      expect(second[0]!.deleted).toBe(3);
      expect(second[0]!.done).toBe(true);
      expect(await threadIds()).toEqual([]);
    });

    it('is bounded by maxBatches', async () => {
      for (let i = 0; i < 5; i++) await seedThread(store, `old-${i}`, 40);

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 1 } }, { maxBatches: 2 });

      expect(results[0]!.deleted).toBe(2);
      expect(results[0]!.done).toBe(false);
      expect((await threadIds()).length).toBe(3);
    });

    it('stops on a pre-aborted signal and reports done:false', async () => {
      for (let i = 0; i < 3; i++) await seedThread(store, `old-${i}`, 40);

      const controller = new AbortController();
      controller.abort();

      const results = await store.stores.memory!.prune({ threads: { maxAge: '30d' } }, { signal: controller.signal });

      expect(results[0]).toMatchObject({ deleted: 0, done: false });
      expect((await threadIds()).length).toBe(3);
    });

    it('rejects a non-positive batchSize instead of looping forever', async () => {
      await expect(store.stores.memory!.prune({ threads: { maxAge: '30d', batchSize: 0 } })).rejects.toThrow(
        /positive/,
      );
    });
  });

  describe('composite prune()', () => {
    beforeEach(async () => {
      await db().collection(TABLE_THREADS).deleteMany({});
    });

    it('routes per-table policies to the memory domain via retention config', async () => {
      const configured = newStore(DB, { retention: { memory: { threads: { maxAge: '30d' } } } });
      await configured.init();
      try {
        await seedThread(configured, 'old-1', 40);
        await seedThread(configured, 'new-1', 5);

        const results = await configured.prune();

        expect(results.map(r => r.table)).toContain(TABLE_THREADS);
        expect(await threadIds()).toEqual(['new-1']);
      } finally {
        await configured.close().catch(() => {});
      }
    });

    it('is a no-op returning [] when no retention is configured', async () => {
      await seedThread(store, 'old-1', 90);
      expect(await store.prune()).toEqual([]);
      expect(await threadIds()).toEqual(['old-1']);
    });
  });

  // background_tasks.completedAt is stored as an ISO-8601 *string*
  // (`toISOString()`), not a BSON date — the cutoff must be a string too or
  // Mongo's type-bracketed `$lt` would silently match nothing.
  describe('backgroundTasks (ISO-string anchor)', () => {
    beforeEach(async () => {
      await db().collection(TABLE_BACKGROUND_TASKS).deleteMany({});
    });

    function seedTask(id: string, completedAgeDays: number | null) {
      const createdAt = new Date(Date.now() - 90 * DAY).toISOString();
      return db()
        .collection(TABLE_BACKGROUND_TASKS)
        .insertOne({
          id,
          tool_call_id: `call-${id}`,
          tool_name: 'tool',
          agent_id: 'agent-1',
          run_id: `run-${id}`,
          status: completedAgeDays == null ? 'running' : 'completed',
          args: {},
          retry_count: 0,
          max_retries: 0,
          timeout_ms: 300_000,
          createdAt,
          completedAt: completedAgeDays == null ? null : new Date(Date.now() - completedAgeDays * DAY).toISOString(),
        });
    }

    it('deletes completed tasks older than maxAge using string comparison', async () => {
      await seedTask('done-old', 40);
      await seedTask('done-recent', 5);

      const results = await store.stores.backgroundTasks!.prune({ backgroundTasks: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'backgroundTasks', table: TABLE_BACKGROUND_TASKS, done: true });
      expect(results[0]!.deleted).toBe(1);

      const remaining = await db()
        .collection(TABLE_BACKGROUND_TASKS)
        .find({})
        .project<{ id: string }>({ id: 1 })
        .toArray();
      expect(remaining.map(d => d.id)).toEqual(['done-recent']);
    });

    it('never prunes in-flight tasks (completedAt null), regardless of age', async () => {
      await seedTask('in-flight', null); // createdAt 90d ago, still running

      const results = await store.stores.backgroundTasks!.prune({ backgroundTasks: { maxAge: '30d' } });

      expect(results[0]!.deleted).toBe(0);
      expect(await db().collection(TABLE_BACKGROUND_TASKS).countDocuments({})).toBe(1);
    });
  });

  // schedule_triggers.actual_fire_at is a raw epoch-ms number, so the cutoff
  // is compared numerically rather than as a BSON date.
  describe('schedules (epoch-ms anchor)', () => {
    beforeEach(async () => {
      await db().collection(TABLE_SCHEDULE_TRIGGERS).deleteMany({});
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
      expect(results[0]).toMatchObject({ domain: 'schedules', table: TABLE_SCHEDULE_TRIGGERS, done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await triggerIds()).toEqual(['new-1']);
    });

    it('leaves fire history untouched when the triggers policy is unset', async () => {
      await seedTrigger('old-1', 90);
      expect(await store.stores.schedules!.prune({})).toEqual([]);
      expect(await triggerIds()).toEqual(['old-1']);
    });
  });

  // Experiments prune as whole units: each batch collects aged parent ids and
  // deletes their results + the experiments together (transactional on replica
  // sets, sequential children-first on standalone), so a run is never hollow.
  describe('experiments (whole-unit cascade)', () => {
    beforeEach(async () => {
      await db().collection(TABLE_EXPERIMENTS).deleteMany({});
      await db().collection(TABLE_EXPERIMENT_RESULTS).deleteMany({});
    });

    async function seedExperiment(id: string, completedAgeDays: number | null, resultCount: number) {
      const now = new Date();
      await db()
        .collection(TABLE_EXPERIMENTS)
        .insertOne({
          id,
          targetType: 'agent',
          targetId: 'agent-1',
          status: completedAgeDays == null ? 'running' : 'completed',
          totalItems: resultCount,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          startedAt: now,
          completedAt: completedAgeDays == null ? null : new Date(Date.now() - completedAgeDays * DAY),
          createdAt: now,
          updatedAt: now,
        });
      for (let i = 0; i < resultCount; i++) {
        await db()
          .collection(TABLE_EXPERIMENT_RESULTS)
          .insertOne({
            id: `${id}-r${i}`,
            experimentId: id,
            itemId: `item-${i}`,
            input: {},
            startedAt: now,
            completedAt: now,
            retryCount: 0,
            createdAt: now,
          });
      }
    }

    async function counts() {
      return {
        experiments: await db().collection(TABLE_EXPERIMENTS).countDocuments({}),
        results: await db().collection(TABLE_EXPERIMENT_RESULTS).countDocuments({}),
      };
    }

    it('deletes an aged experiment and its results together, keeping running ones', async () => {
      await seedExperiment('old', 40, 3); // completed 40d ago
      await seedExperiment('recent', 5, 2); // completed 5d ago
      await seedExperiment('running', null, 4); // still running (completedAt null)

      const results = await store.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      const resultRow = results.find(r => r.table === TABLE_EXPERIMENT_RESULTS)!;
      const expRow = results.find(r => r.table === TABLE_EXPERIMENTS)!;
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

      const expRow = results.find(r => r.table === TABLE_EXPERIMENTS)!;
      expect(expRow.deleted).toBe(2);
      expect(expRow.done).toBe(false);

      // The surviving experiment kept its full result set — never hollow.
      expect(await counts()).toEqual({ experiments: 1, results: 3 });
      const survivors = await db().collection(TABLE_EXPERIMENTS).find({}).project<{ id: string }>({ id: 1 }).toArray();
      const orphans = await db()
        .collection(TABLE_EXPERIMENT_RESULTS)
        .countDocuments({ experimentId: { $nin: survivors.map(d => d.id) } });
      expect(orphans).toBe(0);
    });

    it('returns both tables with deleted:0 done:false on a pre-aborted signal', async () => {
      await seedExperiment('old', 40, 2);

      const controller = new AbortController();
      controller.abort();

      const results = await store.stores.experiments!.prune(
        { experiments: { maxAge: '30d' } },
        { signal: controller.signal },
      );

      expect(results).toEqual([
        { domain: 'experiments', table: TABLE_EXPERIMENT_RESULTS, deleted: 0, done: false },
        { domain: 'experiments', table: TABLE_EXPERIMENTS, deleted: 0, done: false },
      ]);
      expect(await counts()).toEqual({ experiments: 1, results: 2 });
    });
  });

  // Ownership documents age on `updatedAt` (inactivity), fences on
  // `retiredAt`, which stays null until the execution holding the fence
  // settles. Both anchors are BSON dates written from `$$NOW`.
  describe('run ownership', () => {
    const LEASE_MS = 60_000;

    beforeEach(async () => {
      await db().collection(TABLE_WORKFLOW_RUN_OWNERS).deleteMany({});
      await db().collection(TABLE_MEMORY_RUN_FENCES).deleteMany({});
    });

    async function claim(runId: string, ownerId = 'owner-a') {
      const claimed = await store.stores.workflows!.claimRunOwnership({ runId, ownerId, leaseMs: LEASE_MS });
      if (!claimed.acquired) throw new Error(`claim of ${runId} failed`);
      return { runId, generation: claimed.record.generation, ownerId: claimed.record.ownerId };
    }

    async function backdate(collection: string, field: string, runId: string, ageDays: number) {
      await db()
        .collection<{ _id: string }>(collection)
        .updateOne({ _id: runId }, { $set: { [field]: new Date(Date.now() - ageDays * DAY) } });
    }

    const backdateOwner = (runId: string, ageDays: number) =>
      backdate(TABLE_WORKFLOW_RUN_OWNERS, 'updatedAt', runId, ageDays);
    const backdateRetired = (runId: string, ageDays: number) =>
      backdate(TABLE_MEMORY_RUN_FENCES, 'retiredAt', runId, ageDays);

    async function runIds(collection: string): Promise<string[]> {
      const docs = await db()
        .collection<{ _id: string }>(collection)
        .find({})
        .project<{ _id: string }>({ _id: 1 })
        .toArray();
      return docs.map(d => d._id).sort();
    }

    const ownerRunIds = () => runIds(TABLE_WORKFLOW_RUN_OWNERS);
    const fenceRunIds = () => runIds(TABLE_MEMORY_RUN_FENCES);

    it('deletes owner documents idle longer than maxAge and keeps one that was just renewed', async () => {
      await claim('run-idle');
      const live = await claim('run-live');
      await backdateOwner('run-idle', 40);
      await backdateOwner('run-live', 40);

      const renewed = await store.stores.workflows!.renewRunOwnership({ ...live, leaseMs: LEASE_MS });
      expect(renewed.renewed).toBe(true);

      const results = await store.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'workflows', table: TABLE_WORKFLOW_RUN_OWNERS, done: true });
      expect(results[0]!.deleted).toBe(1);
      expect(await ownerRunIds()).toEqual(['run-live']);
    });

    // The two collections are pruned independently. A claim after its owner
    // document was pruned must still land above the surviving fence, or the
    // execution could never raise it.
    it('claims above a surviving fence after the owner document was pruned', async () => {
      const first = await claim('run-reused', 'owner-a');
      expect(await store.stores.memory!.raiseRunFence(first)).toBe(true);
      await backdateOwner('run-reused', 40);

      await store.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });
      expect(await store.stores.workflows!.getRunOwnership({ runId: 'run-reused' })).toBeNull();
      expect(await fenceRunIds()).toEqual(['run-reused']);

      const second = await claim('run-reused', 'owner-b');
      expect(second.generation).toBeGreaterThan(first.generation);
      expect(await store.stores.memory!.raiseRunFence(second)).toBe(true);
    });

    it('never deletes an un-retired fence and deletes a retired one older than maxAge', async () => {
      const running = { runId: 'run-running', generation: Date.now(), ownerId: 'owner-a' };
      const retiredOld = { runId: 'run-retired-old', generation: Date.now(), ownerId: 'owner-a' };
      const retiredNew = { runId: 'run-retired-new', generation: Date.now(), ownerId: 'owner-a' };
      for (const fence of [running, retiredOld, retiredNew]) {
        expect(await store.stores.memory!.raiseRunFence(fence)).toBe(true);
      }
      expect(await store.stores.memory!.retireRunFence(retiredOld)).toBe(true);
      expect(await store.stores.memory!.retireRunFence(retiredNew)).toBe(true);
      await backdateRetired('run-retired-old', 40);

      const results = await store.stores.memory!.prune({ runFences: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'memory', table: TABLE_MEMORY_RUN_FENCES, done: true });
      expect(results[0]!.deleted).toBe(1);
      expect(await fenceRunIds()).toEqual(['run-retired-new', 'run-running']);
    });

    it('un-retires a fence when a later execution raises it, so prune keeps it', async () => {
      const first = { runId: 'run-resumed', generation: Date.now(), ownerId: 'owner-a' };
      expect(await store.stores.memory!.raiseRunFence(first)).toBe(true);
      expect(await store.stores.memory!.retireRunFence(first)).toBe(true);
      await backdateRetired('run-resumed', 40);

      const next = { ...first, generation: first.generation + 1, ownerId: 'owner-b' };
      expect(await store.stores.memory!.raiseRunFence(next)).toBe(true);

      await store.stores.memory!.prune({ runFences: { maxAge: '30d' } });

      expect(await fenceRunIds()).toEqual(['run-resumed']);
    });

    it('routes workflows.runOwnership and memory.runFences through the composite prune()', async () => {
      const configured = newStore(DB, {
        retention: { workflows: { runOwnership: { maxAge: '30d' } }, memory: { runFences: { maxAge: '30d' } } },
      });
      await configured.init();
      try {
        const fence = await claim('run-settled');
        expect(await store.stores.memory!.raiseRunFence(fence)).toBe(true);
        expect(await store.stores.memory!.retireRunFence(fence)).toBe(true);
        await backdateOwner('run-settled', 40);
        await backdateRetired('run-settled', 40);

        const results = await configured.prune();

        expect(results.map(r => r.table)).toEqual(
          expect.arrayContaining([TABLE_WORKFLOW_RUN_OWNERS, TABLE_MEMORY_RUN_FENCES]),
        );
        expect(await ownerRunIds()).toEqual([]);
        expect(await fenceRunIds()).toEqual([]);
      } finally {
        await configured.close().catch(() => {});
      }
    });

    // Each batch finds aged _ids, then deletes them. A run renewed in between
    // must survive, so the delete re-checks the anchor.
    it('keeps a document renewed between the batch find and its delete', async () => {
      const live = await claim('run-renewed-mid-prune');
      await backdateOwner('run-renewed-mid-prune', 40);

      const find = Collection.prototype.find;
      const spy = vi.spyOn(Collection.prototype, 'find').mockImplementation(function (
        this: Collection,
        ...args: any[]
      ) {
        const cursor = (find as (...a: any[]) => ReturnType<Collection['find']>).apply(this, args);
        if (this.collectionName !== TABLE_WORKFLOW_RUN_OWNERS) return cursor;
        const toArray = cursor.toArray.bind(cursor);
        cursor.toArray = async () => {
          const docs = await toArray();
          const renewed = await store.stores.workflows!.renewRunOwnership({ ...live, leaseMs: LEASE_MS });
          expect(renewed.renewed).toBe(true);
          return docs;
        };
        return cursor;
      } as any);

      try {
        const results = await store.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });
        expect(spy).toHaveBeenCalled();
        expect(results[0]!.deleted).toBe(0);
      } finally {
        spy.mockRestore();
      }
      expect(await ownerRunIds()).toEqual(['run-renewed-mid-prune']);
    });
  });

  // Anchor indexes are created lazily on the first prune() call — never at
  // init() — so deployments that don't configure retention pay no index
  // write/disk overhead on their growth collections. Each test uses its own
  // database so the shared store's earlier prune calls can't leak indexes in.
  describe('lazy anchor indexes', () => {
    function lazyDb() {
      const name = `mastra-retlazy-test-${Math.random().toString(36).slice(2, 8)}`;
      extraDbs.push(name);
      return name;
    }

    async function indexKeys(dbName: string, collection: string): Promise<Record<string, unknown>[]> {
      try {
        const indexes = await client.db(dbName).collection(collection).indexes();
        return indexes.map(idx => idx.key);
      } catch {
        return []; // collection doesn't exist yet => no indexes
      }
    }

    const hasCreatedAtIndex = (keys: Record<string, unknown>[]) =>
      keys.some(key => Object.keys(key).length === 1 && 'createdAt' in key);

    it('creates the anchor index on first prune, not at init', async () => {
      const dbName = lazyDb();
      const lazyStore = newStore(dbName);
      await lazyStore.init();
      try {
        await seedThread(lazyStore, 'old-1', 40);
        expect(hasCreatedAtIndex(await indexKeys(dbName, TABLE_THREADS))).toBe(false);

        await lazyStore.stores.memory!.prune({ threads: { maxAge: '30d' } });

        expect(hasCreatedAtIndex(await indexKeys(dbName, TABLE_THREADS))).toBe(true);
      } finally {
        await lazyStore.close().catch(() => {});
      }
    });

    it('creates retention indexes even with skipDefaultIndexes: true (out-of-band of the default set)', async () => {
      const dbName = lazyDb();
      const lazyStore = newStore(dbName, { skipDefaultIndexes: true });
      await lazyStore.init();
      try {
        await seedThread(lazyStore, 'old-1', 40);
        expect(hasCreatedAtIndex(await indexKeys(dbName, TABLE_THREADS))).toBe(false);

        await lazyStore.stores.memory!.prune({ threads: { maxAge: '30d' } });

        expect(hasCreatedAtIndex(await indexKeys(dbName, TABLE_THREADS))).toBe(true);
      } finally {
        await lazyStore.close().catch(() => {});
      }
    });

    it('creates the experiments anchor index lazily via its whole-unit prune path', async () => {
      const dbName = lazyDb();
      const lazyStore = newStore(dbName);
      await lazyStore.init();
      try {
        expect((await indexKeys(dbName, TABLE_EXPERIMENTS)).some(key => 'completedAt' in key)).toBe(false);

        await lazyStore.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

        expect((await indexKeys(dbName, TABLE_EXPERIMENTS)).some(key => 'completedAt' in key)).toBe(true);
      } finally {
        await lazyStore.close().catch(() => {});
      }
    });

    it('creates the runOwnership and runFences anchor indexes on first prune', async () => {
      const dbName = lazyDb();
      const lazyStore = newStore(dbName);
      await lazyStore.init();
      const hasIndexOn = (keys: Record<string, unknown>[], field: string) =>
        keys.some(key => Object.keys(key).length === 1 && field in key);
      try {
        expect(hasIndexOn(await indexKeys(dbName, TABLE_WORKFLOW_RUN_OWNERS), 'updatedAt')).toBe(false);
        expect(hasIndexOn(await indexKeys(dbName, TABLE_MEMORY_RUN_FENCES), 'retiredAt')).toBe(false);

        await lazyStore.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });
        await lazyStore.stores.memory!.prune({ runFences: { maxAge: '30d' } });

        expect(hasIndexOn(await indexKeys(dbName, TABLE_WORKFLOW_RUN_OWNERS), 'updatedAt')).toBe(true);
        expect(hasIndexOn(await indexKeys(dbName, TABLE_MEMORY_RUN_FENCES), 'retiredAt')).toBe(true);
      } finally {
        await lazyStore.close().catch(() => {});
      }
    });
  });
});
