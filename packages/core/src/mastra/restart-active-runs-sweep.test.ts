/**
 * The boot-time sweep reads active runs a page at a time and skips the runs
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
import { runLivenessKey } from '../workflows/evented/step-lease';
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
  { createdAt, status = 'running' }: { createdAt?: Date; status?: WorkflowRunStatus } = {},
) {
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({
    workflowName: 'recovered-wf',
    runId,
    createdAt,
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

      // More live runs than the sweep reads per page (a hundred). The process driving them keeps
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

  it.each([
    ['each run was created at its own time', (i: number) => new Date(Date.now() - 60_000 + i * 7)],
    [
      'more runs were created in one millisecond than fit in a page',
      (i: number) => new Date(1_700_000_000_000 + Math.floor(i / 150)),
    ],
    ['the store does not page by createdAt', (i: number) => new Date(Date.now() - 60_000 + i * 7)],
  ])('restarts each orphaned run once among many active runs when %s', async (scenario, createdAt) => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const mastra = startReplica(storage, 'default', runId => void executions.push(runId));
    // Orphaned runs finish while the sweep still reads later pages, so they leave the status
    // filter an offset-paged read counts from.
    // Runs another process drives stay in it.
    const runIds = Array.from({ length: 300 }, (_, i) => `run-${i}`);
    const orphaned = runIds.filter((_, i) => i % 2 === 0);
    for (const [i, runId] of runIds.entries()) {
      await persistActiveRun(storage, runId, {
        createdAt: createdAt(i),
        status: i % 10 < 2 ? 'waiting' : 'running',
      });
      if (!orphaned.includes(runId)) {
        await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000 });
      }
    }
    const list = store.listWorkflowRuns.bind(store);
    const listCalls = vi.spyOn(store, 'listWorkflowRuns');
    const pagesByRunId = scenario === 'the store does not page by createdAt';
    if (pagesByRunId) {
      // Pages by run id, the way DynamoDB lists a workflow's runs by its sort key.
      vi.spyOn(store, 'listsWorkflowRunsByCreatedAt').mockReturnValue(false);
      listCalls.mockImplementation(async ({ perPage, page, ...args } = {}) => {
        const { runs } = await list(args);
        runs.sort((a, b) => a.runId.localeCompare(b.runId));
        const size = typeof perPage === 'number' ? perPage : runs.length;
        const paged = typeof page === 'number' ? runs.slice(page * size, (page + 1) * size) : runs;
        return { runs: paged, total: runs.length };
      });
    }

    await mastra.restartAllActiveWorkflowRuns();

    expect([...executions].sort()).toEqual([...orphaned].sort());
    // Such a store is read once per status in full rather than once per page.
    if (pagesByRunId) {
      const reads = listCalls.mock.calls.filter(([args]) => args?.workflowName === 'recovered-wf');
      expect(reads.map(([args]) => args?.perPage)).toEqual([false, false]);
    }
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
    for (const runId of runIds) await persistActiveRun(storage, runId);

    const sweep = mastra.restartAllActiveWorkflowRuns();

    // With one slot, a sweep that waited for each run would still be on the first one.
    await vi.waitFor(() => expect([...started].sort()).toEqual(runIds));
    await sweep;
    finish();
    await vi.waitFor(async () => expect(await statuses(storage)).toEqual(new Set(['success'])));
  });
});
