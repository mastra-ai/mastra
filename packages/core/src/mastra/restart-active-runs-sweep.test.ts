/**
 * The boot-time sweep handles active runs in batches and skips the runs
 * another process keeps alive before loading them (#28712). Each replica is a
 * Mastra instance sharing one store, the way pods share one database.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { createStep, createWorkflow } from '../workflows';
import type { WorkflowRunStatus } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { runLivenessKey } from '../workflows/evented/leases';
import { Mastra } from './index';

type Engine = 'default' | 'evented';

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

/** A replica whose `recovered-wf` workflow runs one step that calls `execute` with the run id. */
function startReplica(
  storage: InMemoryStore,
  engine: Engine,
  execute: (runId: string) => void | Promise<void>,
  recovery?: { workflowConcurrency?: number },
) {
  const [create, step] =
    engine === 'evented'
      ? ([createEventedWorkflow, createEventedStep] as const)
      : ([createWorkflow, createStep] as const);
  const workflow = (create as typeof createWorkflow)({
    id: 'recovered-wf',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(
      (step as typeof createStep)({
        id: 'work',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ runId }) => {
          await execute(runId);
          return {};
        },
      }),
    )
    .commit();
  const mastra = new Mastra({ logger: false, storage, workflows: { 'recovered-wf': workflow }, recovery });
  replicas.push(mastra);
  return mastra;
}

/** Stores a run its process left `status` before its first step finished, as a crash leaves it. */
async function persistActiveRun(
  storage: InMemoryStore,
  runId: string,
  { status = 'running' }: { status?: WorkflowRunStatus } = {},
) {
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({
    workflowName: 'recovered-wf',
    runId,
    snapshot: { ...createEmptyWorkflowSnapshot(runId), status, activePaths: [], context: { input: {} } as any },
  });
}

/** Counts how often each run's snapshot is loaded. */
async function countLoads(storage: InMemoryStore) {
  const store = (await storage.getStore('workflows'))!;
  const load = store.loadWorkflowSnapshot.bind(store);
  const loads = new Map<string, number>();
  vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async args => {
    loads.set(args.runId, (loads.get(args.runId) ?? 0) + 1);
    return load(args);
  });
  return loads;
}

/** The stored status of every `recovered-wf` run. */
async function statuses(storage: InMemoryStore) {
  const store = (await storage.getStore('workflows'))!;
  const { runs } = await store.listWorkflowRuns({ workflowName: 'recovered-wf' });
  return new Set(runs.map(run => (typeof run.snapshot === 'string' ? undefined : run.snapshot.status)));
}

describe('boot-time workflow recovery sweep (#28712)', () => {
  it.each(['default', 'evented'] as const)(
    '%s: leaves runs other processes keep alive unloaded and recovers the orphaned one',
    async engine => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const executions: string[] = [];
      const mastra = startReplica(storage, engine, runId => void executions.push(runId));

      // More live runs than the sweep handles per batch (a hundred). The process driving them keeps
      // their lease fresh: evented workers through the run's liveness key, a default-engine run
      // through its run lease.
      const liveRunIds = Array.from({ length: 250 }, (_, i) => `live-${i}`);
      const liveKeys = liveRunIds.map(runId => (engine === 'evented' ? runLivenessKey(runId) : runId));
      for (const [i, runId] of liveRunIds.entries()) {
        await persistActiveRun(storage, runId);
        await store.claimRunOwnership({ runId: liveKeys[i]!, ownerId: 'other-process', leaseMs: 60_000 });
      }

      await persistActiveRun(storage, 'orphaned');
      const loads = await countLoads(storage);

      await mastra.restartAllActiveWorkflowRuns();

      await vi.waitFor(() => expect(executions).toEqual(['orphaned']));
      expect(loads.get('orphaned')).toBeGreaterThan(0);
      expect(liveRunIds.filter(runId => loads.has(runId))).toEqual([]);
    },
  );

  it('restarts each orphaned run once among many active runs, reading ownership once per hundred runs', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', runId => void executions.push(runId));
    // Orphaned runs finish while the sweep still works through later batches. Runs another
    // process drives stay active.
    const runIds = Array.from({ length: 300 }, (_, i) => `run-${i}`);
    const orphaned = runIds.filter((_, i) => i % 2 === 0);
    for (const [i, runId] of runIds.entries()) {
      await persistActiveRun(storage, runId, { status: i % 10 < 2 ? 'waiting' : 'running' });
      if (!orphaned.includes(runId)) {
        await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000 });
      }
    }

    const listCalls = vi.spyOn(store, 'listWorkflowRuns');
    const ownershipReads = vi.spyOn(store, 'getRunOwnerships');

    await mastra.restartAllActiveWorkflowRuns();

    expect([...executions].sort()).toEqual([...orphaned].sort());
    const reads = listCalls.mock.calls.filter(([args]) => args?.workflowName === 'recovered-wf');
    expect(reads.map(([args]) => [args?.status, args?.perPage])).toEqual([
      ['running', false],
      ['waiting', false],
    ]);
    // 240 running runs and 60 waiting ones.
    expect(ownershipReads.mock.calls.map(([args]) => args.runIds.length)).toEqual([100, 100, 40, 60]);
  });

  it('restarts a run once when it moves from running to waiting between the two listings', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = startReplica(storage, 'default', () => {});
    const runIds = Array.from({ length: 150 }, (_, i) => `run-${i}`);
    for (const runId of runIds) {
      await persistActiveRun(storage, runId);
    }

    const list = store.listWorkflowRuns.bind(store);
    let markSuspended!: () => void;
    const suspended = new Promise<void>(resolve => (markSuspended = resolve));
    vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async (args = {}) => {
      if (args.workflowName !== 'recovered-wf') {
        return list(args);
      }

      // The `waiting` listing reads only after a sleep step suspended every run the `running` one returned.
      if (args.status === 'waiting') {
        await suspended;
        return list(args);
      }

      const listed = await list(args);
      for (const run of listed.runs) {
        await persistActiveRun(storage, run.runId, { status: 'waiting' });
      }

      markSuspended();
      return listed;
    });
    // The restarts never finish the runs, so every run is still waiting when that status is listed.
    const restarted: string[] = [];
    vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun').mockImplementation(async ({ runId } = {}) => {
      restarted.push(runId!);
      return { restart: async () => {} } as any;
    });

    await mastra.restartAllActiveWorkflowRuns();

    expect([...restarted].sort()).toEqual([...runIds].sort());
  });

  it('restarts a waiting run that becomes running while the sweep restarts the running runs', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const mastra = startReplica(storage, 'default', () => {});
    await persistActiveRun(storage, 'running-run');
    await persistActiveRun(storage, 'woken-run', { status: 'waiting' });

    // The sleeping run wakes, and its process dies, while the sweep handles the running runs.
    const readOwners = store.getRunOwnerships.bind(store);
    vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
      if (args.runIds.includes('running-run')) {
        await persistActiveRun(storage, 'woken-run', { status: 'running' });
      }

      return readOwners(args);
    });
    const restarted: string[] = [];
    vi.spyOn(mastra.getWorkflow('recovered-wf'), 'createRun').mockImplementation(async ({ runId } = {}) => {
      restarted.push(runId!);
      return { restart: async () => {} } as any;
    });

    await mastra.restartAllActiveWorkflowRuns();

    expect([...restarted].sort()).toEqual(['running-run', 'woken-run']);
  });

  it('hands evented restarts to the workers without waiting for the runs to finish', async () => {
    const storage = new InMemoryStore();
    const started: string[] = [];
    let finish!: () => void;
    const finished = new Promise<void>(resolve => (finish = resolve));
    const mastra = startReplica(
      storage,
      'evented',
      async runId => {
        started.push(runId);
        await finished;
      },
      { workflowConcurrency: 1 },
    );
    const runIds = ['orphaned-a', 'orphaned-b', 'orphaned-c'];
    for (const runId of runIds) {
      await persistActiveRun(storage, runId);
    }

    const sweep = mastra.restartAllActiveWorkflowRuns();

    // With one slot, a sweep that waited for each run would still be on the first one.
    await vi.waitFor(() => expect([...started].sort()).toEqual(runIds));
    await sweep;
    finish();
    await vi.waitFor(async () => expect(await statuses(storage)).toEqual(new Set(['success'])));
  });
});
