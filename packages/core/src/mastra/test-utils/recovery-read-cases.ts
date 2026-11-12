/**
 * What one recovery pass reads from the store, shared by the in-memory,
 * LibSQL and Postgres suites (#28712): runs other processes keep live cost no
 * snapshot read, and a stopped run costs only its own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraStorage } from '../../storage';
import { createEmptyWorkflowSnapshot } from '../../storage/workflow-snapshot';
import { createStep, createWorkflow } from '../../workflows';
import type { WorkflowRunStatus } from '../../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../../workflows/evented';
import { runLivenessKey } from '../../workflows/evented/leases';
import { Mastra } from '../index';

const schema = z.object({});

/** A one-step workflow `id` on the default or evented engine. */
function oneStep(id: string, engine: 'default' | 'evented', executions: string[]) {
  const [create, step] =
    engine === 'evented'
      ? ([createEventedWorkflow, createEventedStep] as const)
      : ([createWorkflow, createStep] as const);
  return (create as typeof createWorkflow)({ id, inputSchema: schema, outputSchema: schema })
    .then(
      (step as typeof createStep)({
        id: 'work',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ runId }) => {
          executions.push(runId);
          return {};
        },
      }),
    )
    .commit();
}

/** Counts every read of the store a recovery pass could make, by method and run. */
async function countReads(storage: MastraStorage) {
  const store = (await storage.getStore('workflows'))!;
  const snapshotReads: string[] = [];
  const listings: { summary?: boolean; snapshots: unknown[] }[] = [];
  const ownershipReads: number[] = [];

  const load = store.loadWorkflowSnapshot.bind(store);
  vi.spyOn(store, 'loadWorkflowSnapshot').mockImplementation(async args => {
    snapshotReads.push(args.runId);
    return load(args);
  });
  const byId = store.getWorkflowRunById.bind(store);
  vi.spyOn(store, 'getWorkflowRunById').mockImplementation(async args => {
    snapshotReads.push(args.runId);
    return byId(args);
  });
  const list = store.listWorkflowRuns.bind(store);
  vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async (args = {}) => {
    const listed = await list(args);
    listings.push({ summary: args.summary, snapshots: listed.runs.map(run => run.snapshot) });
    return listed;
  });
  const owners = store.getRunOwnerships.bind(store);
  vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
    ownershipReads.push(args.runIds.length);
    return owners(args);
  });

  return { snapshotReads, listings, ownershipReads };
}

/** `getStorage` is the store the pass reads; it is cleared before each case. */
export function describeRecoveryReadCases({ getStorage }: { getStorage: () => MastraStorage }) {
  describe('what a workflow recovery pass reads (#28712)', () => {
    const instances: Mastra[] = [];
    afterEach(async () => {
      vi.restoreAllMocks();
      await Promise.all(instances.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
    });

    /** Stores an active run of `workflowName`, nested under `parent` when given. */
    async function persistRun(
      workflowName: string,
      runId: string,
      {
        status = 'running',
        parent,
      }: { status?: WorkflowRunStatus; parent?: { workflowId: string; runId: string } } = {},
    ) {
      const store = (await getStorage().getStore('workflows'))!;
      await store.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: {
          ...createEmptyWorkflowSnapshot(runId),
          status,
          activePaths: [0],
          context: { input: {} } as any,
          ...(parent ? { parentWorkflow: parent } : {}),
        } as any,
      });
    }

    /** Claims `key` for another process for a minute, as a process running the run does. */
    async function keepLive(key: string) {
      const store = (await getStorage().getStore('workflows'))!;
      await store.claimRunOwnership({ runId: key, ownerId: 'other-process', leaseMs: 60_000, force: true });
    }

    it('reads no snapshot of the runs other processes keep live, and only the snapshot of the run it restarts', async () => {
      const store = (await getStorage().getStore('workflows'))!;
      await store.dangerouslyClearAll();
      const executions: string[] = [];
      const mastra = new Mastra({
        logger: false,
        storage: getStorage(),
        workflows: {
          plain: oneStep('plain', 'default', executions),
          evented: oneStep('evented', 'evented', executions),
          parent: oneStep('parent', 'default', executions),
          child: oneStep('child', 'default', executions),
        },
        // Every run that is not live is due at once.
        recovery: { workflowGraceMs: 0 },
      });
      instances.push(mastra);

      // 300 active runs other processes drive. A default-engine nested run holds no lease of its
      // own: its parent's lease covers it.
      for (let i = 0; i < 80; i++) {
        await persistRun('plain', `plain-${i}`, { status: i % 4 === 0 ? 'waiting' : 'running' });
        await keepLive(`plain-${i}`);
        await persistRun('evented', `evented-${i}`, { status: i % 4 === 0 ? 'waiting' : 'running' });
        await keepLive(runLivenessKey(`evented-${i}`));
      }

      for (let i = 0; i < 70; i++) {
        await persistRun('parent', `parent-${i}`);
        await keepLive(`parent-${i}`);
        await persistRun('child', `child-${i}`, { parent: { workflowId: 'parent', runId: `parent-${i}` } });
      }

      const reads = await countReads(getStorage());
      await mastra.restartAllActiveWorkflowRuns();

      expect(reads.snapshotReads).toEqual([]);
      expect(reads.listings.length).toBeGreaterThan(0);
      expect(reads.listings.every(listing => listing.summary === true)).toBe(true);
      expect(
        reads.listings.flatMap(listing => listing.snapshots).some(snapshot => 'context' in (snapshot as object)),
      ).toBe(false);
      // The nested runs are left to their active parents, so 230 runs are checked, a hundred per read.
      expect(reads.ownershipReads).toEqual([100, 100, 30]);
      expect(executions).toEqual([]);

      // Another process crashed while running `stopped`: its lease lapsed.
      await persistRun('plain', 'stopped');
      reads.snapshotReads.length = 0;
      await mastra.restartAllActiveWorkflowRuns();

      expect(executions).toEqual(['stopped']);
      expect(reads.snapshotReads.length).toBeGreaterThan(0);
      expect(new Set(reads.snapshotReads)).toEqual(new Set(['stopped']));
    }, 60_000);
  });
}
