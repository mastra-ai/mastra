import fs from 'node:fs';
import os from 'node:os';
import { createSampleThreadWithParams } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import type { StorageThreadType } from '@mastra/core/memory';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Fresh, isolated in-memory DB per test. A bare `:memory:` url gives each
 * `LibSQLStore` its own private in-memory database (no shared cache), so seeded
 * rows never leak across cases.
 */
function newStore(id: string) {
  return new LibSQLStore({ id, url: ':memory:' });
}

const DAY = 24 * 60 * 60 * 1000;

async function seedThread(store: LibSQLStore, id: string, ageDays: number): Promise<StorageThreadType> {
  const at = new Date(Date.now() - ageDays * DAY);
  const memory = store.stores.memory!;
  const thread = createSampleThreadWithParams(id, `resource-${id}`, at, at) as StorageThreadType;
  await memory.saveThread({ thread });
  return thread;
}

async function threadIds(store: LibSQLStore): Promise<string[]> {
  const memory = store.stores.memory!;
  const { threads } = await memory.listThreads({ perPage: false });
  return threads.map(t => t.id).sort();
}

describe('LibSQL retention', () => {
  let store: LibSQLStore;

  beforeEach(async () => {
    store = newStore(`retention-${Math.random().toString(36).slice(2)}`);
    await store.init();
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

    it('keeps a row exactly at the cutoff and deletes one just past it (strict <)', async () => {
      // Seeded ages are relative to Date.now(); a 30d-old row sits ~at the cutoff.
      // Use a clearly-older and a clearly-newer row to avoid millisecond flakiness.
      await seedThread(store, 'boundary-older', 31);
      await seedThread(store, 'boundary-newer', 29);

      await store.stores.memory!.prune({ threads: { maxAge: '30d' } });

      expect(await threadIds(store)).toEqual(['boundary-newer']);
    });

    it('leaves unset tables untouched (unset = keep forever)', async () => {
      await seedThread(store, 'old-1', 90);

      // No policy for threads => nothing deleted.
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
  });

  describe('composite prune()', () => {
    it('routes per-table policies to the memory domain via retention config', async () => {
      const configured = new LibSQLStore({
        id: `retention-cfg-${Math.random().toString(36).slice(2)}`,
        url: ':memory:',
        retention: { memory: { threads: { maxAge: '30d' } } },
      });
      await configured.init();
      await seedThread(configured, 'old-1', 40);
      await seedThread(configured, 'new-1', 5);

      const results = await configured.prune();

      expect(results.map(r => r.table)).toContain('mastra_threads');
      expect(await threadIds(configured)).toEqual(['new-1']);
    });

    it('is a no-op returning [] when no retention is configured', async () => {
      await seedThread(store, 'old-1', 90);
      expect(await store.prune()).toEqual([]);
      expect(await threadIds(store)).toEqual(['old-1']);
    });
  });

  // schedules.triggers is anchored on `actual_fire_at`, a bigint epoch-ms column,
  // so the cutoff is compared numerically rather than as an ISO string.
  describe('schedules (epoch-ms anchor)', () => {
    async function seedTrigger(s: LibSQLStore, id: string, ageDays: number) {
      const fireAt = Date.now() - ageDays * DAY;
      await s.stores.schedules!.recordTrigger({
        id,
        scheduleId: 'sched-1',
        runId: `run-${id}`,
        scheduledFireAt: fireAt,
        actualFireAt: fireAt,
        outcome: 'succeeded',
      });
    }

    async function triggerIds(s: LibSQLStore): Promise<string[]> {
      const triggers = await s.stores.schedules!.listTriggers('sched-1');
      return triggers.map(t => t.id!).sort();
    }

    it('deletes fire history older than maxAge using numeric epoch comparison', async () => {
      await seedTrigger(store, 'old-1', 40);
      await seedTrigger(store, 'old-2', 40);
      await seedTrigger(store, 'new-1', 5);

      const results = await store.stores.schedules!.prune({ triggers: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'schedules', table: 'mastra_schedule_triggers', done: true });
      expect(results[0]!.deleted).toBe(2);
      expect(await triggerIds(store)).toEqual(['new-1']);
    });

    it('leaves fire history untouched when the triggers policy is unset', async () => {
      await seedTrigger(store, 'old-1', 90);
      expect(await store.stores.schedules!.prune({})).toEqual([]);
      expect(await triggerIds(store)).toEqual(['old-1']);
    });
  });

  // Experiments prune as whole units: an aged experiment's result rows are
  // deleted first (cascade), then the experiment, so a run is never left hollow.
  // Uses a file-backed DB so tests can seed an old completed experiment directly.
  describe('experiments (whole-unit cascade)', () => {
    let fileStore: LibSQLStore;
    let url: string;

    beforeEach(async () => {
      url = `file:${tmpFile()}`;
      fileStore = new LibSQLStore({ id: `exp-${Math.random().toString(36).slice(2)}`, url });
      await fileStore.init();
    });

    afterEach(() => {
      cleanupTmp(url);
    });

    /** Insert an experiment (+ N results) directly so completedAt can be backdated. */
    async function seedExperiment(id: string, completedAgeDays: number | null, resultCount: number) {
      const raw = createClient({ url });
      const completedAt = completedAgeDays == null ? null : new Date(Date.now() - completedAgeDays * DAY).toISOString();
      const now = new Date().toISOString();
      await raw.execute({
        sql: `INSERT INTO mastra_experiments (id, targetType, targetId, status, totalItems, succeededCount, failedCount, skippedCount, startedAt, completedAt, createdAt, updatedAt) VALUES (?, 'agent', 'agent-1', 'completed', ?, 0, 0, 0, ?, ?, ?, ?)`,
        args: [id, resultCount, now, completedAt, now, now],
      });
      for (let i = 0; i < resultCount; i++) {
        await raw.execute({
          sql: `INSERT INTO mastra_experiment_results (id, experimentId, itemId, input, startedAt, completedAt, retryCount, createdAt) VALUES (?, ?, ?, '{}', ?, ?, 0, ?)`,
          args: [`${id}-r${i}`, id, `item-${i}`, now, now, now],
        });
      }
      raw.close();
    }

    async function counts() {
      const raw = createClient({ url });
      const exp = await raw.execute('SELECT COUNT(*) AS c FROM mastra_experiments');
      const res = await raw.execute('SELECT COUNT(*) AS c FROM mastra_experiment_results');
      raw.close();
      return { experiments: Number(exp.rows[0]!.c), results: Number(res.rows[0]!.c) };
    }

    it('deletes an aged experiment and its results together, keeping running ones', async () => {
      await seedExperiment('old', 40, 3); // completed 40d ago
      await seedExperiment('recent', 5, 2); // completed 5d ago
      await seedExperiment('running', null, 4); // still running (completedAt NULL)

      const results = await fileStore.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

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

      await fileStore.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      // Both the parent and all its children are gone — no orphaned results.
      expect(await counts()).toEqual({ experiments: 0, results: 0 });
    });

    it('removes whole units per batch, so bounds never strip results off surviving runs', async () => {
      await seedExperiment('old-a', 40, 3);
      await seedExperiment('old-b', 41, 3);
      await seedExperiment('old-c', 42, 3);

      // batchSize 1 + maxBatches 2 => exactly two whole experiments removed.
      const results = await fileStore.stores.experiments!.prune(
        { experiments: { maxAge: '30d', batchSize: 1 } },
        { maxBatches: 2 },
      );

      const expRow = results.find(r => r.table === 'mastra_experiments')!;
      expect(expRow.deleted).toBe(2);
      expect(expRow.done).toBe(false);

      // The surviving experiment kept its full result set — never hollow.
      expect(await counts()).toEqual({ experiments: 1, results: 3 });
      const raw = createClient({ url });
      const orphans = await raw.execute(
        'SELECT COUNT(*) AS c FROM mastra_experiment_results r WHERE NOT EXISTS (SELECT 1 FROM mastra_experiments e WHERE e.id = r.experimentId)',
      );
      raw.close();
      expect(Number(orphans.rows[0]!.c)).toBe(0);
    });
  });

  // The workflowSnapshot policy also covers storage v2 runs, anchored on the header's
  // `updatedAt`; each pruned run takes its entries with it. Uses a file-backed DB so
  // tests can backdate rows directly.
  describe('storage v2 workflow runs', () => {
    let fileStore: LibSQLStore;
    let url: string;

    beforeEach(async () => {
      url = `file:${tmpFile()}`;
      fileStore = new LibSQLStore({ id: `wf-v2-${Math.random().toString(36).slice(2)}`, url });
      await fileStore.init();
    });

    afterEach(() => {
      cleanupTmp(url);
    });

    const snapshotFor = (runId: string, context: Record<string, unknown>) =>
      ({
        runId,
        status: 'running',
        value: {},
        context,
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: 1,
      }) as unknown as WorkflowRunState;

    const step = (output: unknown) => ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 });

    // A checkpoint then one append per step, so each run has several entries.
    async function seedRun(runId: string, ageDays: number, storageVersion: 1 | 2 = 2) {
      const workflows = fileStore.stores.workflows!;
      const context: Record<string, unknown> = { input: {}, a: step(1) };
      if (storageVersion === 1) {
        await workflows.persistWorkflowSnapshot({ workflowName: 'wf', runId, snapshot: snapshotFor(runId, context) });
      } else {
        const { context: steps, value: state, ...header } = snapshotFor(runId, context);
        await workflows.writeWorkflowRunCheckpoint({ workflowName: 'wf', runId, header, steps, state });
        for (const id of ['b', 'c']) {
          await workflows.appendWorkflowRunEntries({ workflowName: 'wf', runId, header, steps: { [id]: step(id) } });
        }
      }
      const table = storageVersion === 2 ? 'mastra_workflow_runs' : 'mastra_workflow_snapshot';
      const raw = createClient({ url });
      await raw.execute({
        sql: `UPDATE ${table} SET updatedAt = ? WHERE run_id = ?`,
        args: [new Date(Date.now() - ageDays * DAY).toISOString(), runId],
      });
      raw.close();
    }

    async function query(sql: string) {
      const raw = createClient({ url });
      const result = await raw.execute(sql);
      raw.close();
      return result.rows;
    }

    const runIds = async (table: string) =>
      (await query(`SELECT DISTINCT run_id FROM ${table} ORDER BY run_id`)).map(r => String(r.run_id));

    it('deletes aged v2 runs with their entries and keeps recent runs and their entries', async () => {
      await seedRun('v2-old-1', 40);
      await seedRun('v2-old-2', 40);
      await seedRun('v2-new', 5);
      await seedRun('v1-old', 40, 1);
      await seedRun('v1-new', 5, 1);

      const results = await fileStore.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } });

      expect(results.map(r => [r.table, r.deleted, r.done])).toEqual([
        ['mastra_workflow_snapshot', 1, true],
        ['mastra_workflow_runs', 2, true],
      ]);
      expect(await runIds('mastra_workflow_runs')).toEqual(['v2-new']);
      expect(await runIds('mastra_workflow_run_entries')).toEqual(['v2-new']);
      expect(await runIds('mastra_workflow_snapshot')).toEqual(['v1-new']);
      expect(await fileStore.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v2-new' })).toEqual(
        snapshotFor('v2-new', { input: {}, a: step(1), b: step('b'), c: step('c') }),
      );
      const indexes = await query(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_retention_mastra_workflow_runs_updatedAt'`,
      );
      expect(indexes).toHaveLength(1);
    });

    it('removes whole runs per batch and honors maxRows and maxBatches', async () => {
      for (let i = 0; i < 5; i++) await seedRun(`v2-old-${i}`, 40 + i);

      const bounded = await fileStore.stores.workflows!.prune(
        { workflowSnapshot: { maxAge: '30d', batchSize: 1 } },
        { maxBatches: 2 },
      );
      expect(bounded.find(r => r.table === 'mastra_workflow_runs')).toMatchObject({ deleted: 2, done: false });
      // Oldest first, and the survivors keep every entry.
      expect(await runIds('mastra_workflow_runs')).toEqual(['v2-old-0', 'v2-old-1', 'v2-old-2']);
      expect(await runIds('mastra_workflow_run_entries')).toEqual(['v2-old-0', 'v2-old-1', 'v2-old-2']);
      const [entries] = await query('SELECT COUNT(*) AS c FROM mastra_workflow_run_entries');
      expect(Number(entries!.c)).toBe(3 * 5); // checkpoint (input, a, state) + 2 appends

      const capped = await fileStore.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } }, { maxRows: 2 });
      expect(capped.find(r => r.table === 'mastra_workflow_runs')).toMatchObject({ deleted: 2, done: false });

      const rest = await fileStore.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } });
      expect(rest.find(r => r.table === 'mastra_workflow_runs')).toMatchObject({ deleted: 1, done: true });
      expect(await runIds('mastra_workflow_runs')).toEqual([]);
      expect(await runIds('mastra_workflow_run_entries')).toEqual([]);
    });

    it('recreates a pruned run from the next append, with only what it carries', async () => {
      await seedRun('v2-revived', 40);
      await fileStore.stores.workflows!.prune({ workflowSnapshot: { maxAge: '30d' } });

      const { context: _context, value: _value, ...header } = snapshotFor('v2-revived', {});
      await fileStore.stores.workflows!.appendWorkflowRunEntries({
        workflowName: 'wf',
        runId: 'v2-revived',
        header,
        steps: { d: step('d') },
      });

      expect(
        await fileStore.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v2-revived' }),
      ).toEqual(snapshotFor('v2-revived', { d: step('d') }));
    });
  });

  // Run ownership rows are anchored on `updatedAt` (refreshed by every claim,
  // renew and release), run fence rows on `retiredAt` (NULL until the
  // execution settles). Both are epoch-ms columns written from the database
  // clock, so tests backdate them directly through a file-backed DB.
  describe('run ownership', () => {
    const LEASE_MS = 60_000;
    let fileStore: LibSQLStore;
    let url: string;

    beforeEach(async () => {
      url = `file:${tmpFile()}`;
      fileStore = new LibSQLStore({ id: `run-own-${Math.random().toString(36).slice(2)}`, url });
      await fileStore.init();
    });

    afterEach(() => {
      cleanupTmp(url);
    });

    async function claim(runId: string, ownerId = 'owner-a') {
      const claimed = await fileStore.stores.workflows!.claimRunOwnership({ runId, ownerId, leaseMs: LEASE_MS });
      if (!claimed.acquired) throw new Error(`claim of ${runId} failed`);
      return { runId, generation: claimed.record.generation, ownerId: claimed.record.ownerId };
    }

    async function backdate(table: string, column: string, runId: string, ageDays: number) {
      const raw = createClient({ url });
      await raw.execute({
        sql: `UPDATE ${table} SET ${column} = ? WHERE runId = ?`,
        args: [Date.now() - ageDays * DAY, runId],
      });
      raw.close();
    }

    const backdateOwner = (runId: string, ageDays: number) =>
      backdate('mastra_workflow_run_owners', 'updatedAt', runId, ageDays);
    const backdateRetired = (runId: string, ageDays: number) =>
      backdate('mastra_memory_run_fences', 'retiredAt', runId, ageDays);

    async function runIds(table: string): Promise<string[]> {
      const raw = createClient({ url });
      const rows = await raw.execute(`SELECT runId FROM ${table} ORDER BY runId`);
      raw.close();
      return rows.rows.map(r => String(r.runId));
    }

    const ownerRunIds = () => runIds('mastra_workflow_run_owners');
    const fenceRunIds = () => runIds('mastra_memory_run_fences');

    it('deletes owner rows idle longer than maxAge and keeps one that was just renewed', async () => {
      await claim('run-idle');
      const live = await claim('run-live');
      await backdateOwner('run-idle', 40);
      await backdateOwner('run-live', 40);

      const renewed = await fileStore.stores.workflows!.renewRunOwnership({ ...live, leaseMs: LEASE_MS });
      expect(renewed.renewed).toBe(true);

      const results = await fileStore.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'workflows', table: 'mastra_workflow_run_owners', done: true });
      expect(results[0]!.deleted).toBe(1);
      expect(await ownerRunIds()).toEqual(['run-live']);
    });

    // The two tables are pruned independently. A claim after its owner row was
    // pruned must still land above the surviving fence, or the execution
    // could never raise it.
    it('claims above a surviving fence after the owner row was pruned', async () => {
      const first = await claim('run-reused', 'owner-a');
      expect(await fileStore.stores.memory!.raiseRunFence(first)).toBe(true);
      await backdateOwner('run-reused', 40);

      await fileStore.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });
      expect(await fileStore.stores.workflows!.getRunOwnership({ runId: 'run-reused' })).toBeNull();
      expect(await fenceRunIds()).toEqual(['run-reused']);

      const second = await claim('run-reused', 'owner-b');
      expect(second.generation).toBeGreaterThan(first.generation);
      expect(await fileStore.stores.memory!.raiseRunFence(second)).toBe(true);
    });

    it('never deletes an un-retired fence row and deletes a retired one older than maxAge', async () => {
      const memory = fileStore.stores.memory!;
      const running = { runId: 'run-running', generation: Date.now(), ownerId: 'owner-a' };
      const retiredOld = { runId: 'run-retired-old', generation: Date.now(), ownerId: 'owner-a' };
      const retiredNew = { runId: 'run-retired-new', generation: Date.now(), ownerId: 'owner-a' };
      for (const fence of [running, retiredOld, retiredNew]) {
        expect(await memory.raiseRunFence(fence)).toBe(true);
      }
      expect(await memory.retireRunFence(retiredOld)).toBe(true);
      expect(await memory.retireRunFence(retiredNew)).toBe(true);
      await backdateRetired('run-retired-old', 40);

      const results = await memory.prune({ runFences: { maxAge: '30d' } });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ domain: 'memory', table: 'mastra_memory_run_fences', done: true });
      expect(results[0]!.deleted).toBe(1);
      expect(await fenceRunIds()).toEqual(['run-retired-new', 'run-running']);
    });

    it('un-retires a fence when a later execution raises it, so prune keeps it', async () => {
      const memory = fileStore.stores.memory!;
      const first = { runId: 'run-resumed', generation: Date.now(), ownerId: 'owner-a' };
      expect(await memory.raiseRunFence(first)).toBe(true);
      expect(await memory.retireRunFence(first)).toBe(true);
      await backdateRetired('run-resumed', 40);

      const next = { ...first, generation: first.generation + 1, ownerId: 'owner-b' };
      expect(await memory.raiseRunFence(next)).toBe(true);

      await memory.prune({ runFences: { maxAge: '30d' } });

      expect(await fenceRunIds()).toEqual(['run-resumed']);
    });

    it('routes workflows.runOwnership and memory.runFences through the composite prune()', async () => {
      const fence = await claim('run-settled');
      expect(await fileStore.stores.memory!.raiseRunFence(fence)).toBe(true);
      expect(await fileStore.stores.memory!.retireRunFence(fence)).toBe(true);
      await backdateOwner('run-settled', 40);
      await backdateRetired('run-settled', 40);

      const configured = new LibSQLStore({
        id: `run-own-cfg-${Math.random().toString(36).slice(2)}`,
        url,
        retention: { workflows: { runOwnership: { maxAge: '30d' } }, memory: { runFences: { maxAge: '30d' } } },
      });
      await configured.init();

      const results = await configured.prune();

      expect(results.map(r => r.table)).toEqual(
        expect.arrayContaining(['mastra_workflow_run_owners', 'mastra_memory_run_fences']),
      );
      expect(await ownerRunIds()).toEqual([]);
      expect(await fenceRunIds()).toEqual([]);
    });
  });

  // Anchor indexes are created lazily on the first prune() call — never at
  // init() — so deployments that don't configure retention pay no index
  // write/disk overhead on their growth tables.
  describe('lazy anchor indexes', () => {
    let fileStore: LibSQLStore;
    let url: string;

    beforeEach(async () => {
      url = `file:${tmpFile()}`;
      fileStore = new LibSQLStore({ id: `lazy-${Math.random().toString(36).slice(2)}`, url });
      await fileStore.init();
    });

    afterEach(() => {
      cleanupTmp(url);
    });

    async function retentionIndexes(): Promise<string[]> {
      const raw = createClient({ url });
      const rows = await raw.execute(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_retention_%' ORDER BY name`,
      );
      raw.close();
      return rows.rows.map(r => String(r.name));
    }

    it('creates no anchor indexes at init, only for pruned tables on first prune', async () => {
      expect(await retentionIndexes()).toEqual([]);

      await fileStore.stores.memory!.prune({ threads: { maxAge: '30d' } });

      // Only the table with a policy gets its anchor index; messages/resources don't.
      expect(await retentionIndexes()).toEqual(['idx_retention_mastra_threads_createdAt']);
    });

    it('creates the experiments anchor index lazily via its whole-unit prune path', async () => {
      expect(await retentionIndexes()).toEqual([]);

      await fileStore.stores.experiments!.prune({ experiments: { maxAge: '30d' } });

      expect(await retentionIndexes()).toEqual(['idx_retention_mastra_experiments_completedAt']);
    });

    it('creates the run ownership and run fence anchor indexes on their first prune', async () => {
      expect(await retentionIndexes()).toEqual([]);

      await fileStore.stores.workflows!.prune({ runOwnership: { maxAge: '30d' } });
      await fileStore.stores.memory!.prune({ runFences: { maxAge: '30d' } });

      expect(await retentionIndexes()).toEqual([
        'idx_retention_mastra_memory_run_fences_retiredAt',
        'idx_retention_mastra_workflow_run_owners_updatedAt',
      ]);
    });
  });
});

let tmpCounter = 0;
function tmpFile(): string {
  tmpCounter += 1;
  return `${os.tmpdir()}/libsql-retention-${process.pid}-${Date.now()}-${tmpCounter}.db`;
}

function cleanupTmp(url: string) {
  const path = url.replace(/^file:/, '');
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${path}${suffix}`);
    } catch {
      // best-effort cleanup
    }
  }
}
