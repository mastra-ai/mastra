/**
 * What one recovery pass reads from the store (#28712): default-engine runs
 * other processes hold cost no snapshot read, a stopped run costs only its
 * own, and evented runs a redelivering broker recovers cost no read at all.
 * Run on the in-memory store: what each adapter returns is its conformance
 * suite's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraStorage } from '../../storage';
import { createEmptyWorkflowSnapshot } from '../../storage/workflow-snapshot';
import { createStep, createWorkflow } from '../../workflows';
import type { WorkflowRunStatus } from '../../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../../workflows/evented';
import { Mastra } from '../index';
import { sharedBroker } from './shared-broker';

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
  const listings: { workflowName?: string; status?: string; summary?: boolean; snapshots: unknown[] }[] = [];
  const ownershipReads: string[][] = [];
  const listingsInFlight = { now: 0, max: 0 };

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
    listingsInFlight.max = Math.max(listingsInFlight.max, ++listingsInFlight.now);
    let listed: Awaited<ReturnType<typeof list>>;
    try {
      listed = await list(args);
    } finally {
      listingsInFlight.now--;
    }
    listings.push({
      workflowName: args.workflowName,
      status: args.status,
      summary: args.summary,
      snapshots: listed.runs.map(run => run.snapshot),
    });
    return listed;
  });
  const owners = store.getRunOwnerships.bind(store);
  vi.spyOn(store, 'getRunOwnerships').mockImplementation(async args => {
    ownershipReads.push(args.runIds);
    return owners(args);
  });

  return { snapshotReads, listings, ownershipReads, listingsInFlight };
}

/** `getStorage` is the store the test writes and the recovering instance reads, cleared before each case. */
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

    /** Claims the lease of `runId` for another process for a minute, as a process running the run does. */
    async function keepLive(runId: string) {
      const store = (await getStorage().getStore('workflows'))!;
      await store.claimRunOwnership({ runId, ownerId: 'other-process', leaseMs: 60_000, force: true });
    }

    it('reads no snapshot of the runs other processes hold or a broker recovers, and only the snapshot of the run it restarts', async () => {
      const store = (await getStorage().getStore('workflows'))!;
      await store.dangerouslyClearAll();
      const executions: string[] = [];
      const instanceStorage = getStorage();
      const mastra = new Mastra({
        logger: false,
        storage: instanceStorage,
        pubsub: sharedBroker({ redeliversUnacked: true }).connect(),
        workflows: {
          plain: oneStep('plain', 'default', executions),
          evented: oneStep('evented', 'evented', executions),
          parent: oneStep('parent', 'default', executions),
          child: oneStep('child', 'default', executions),
        },
        // Every default-engine run that is not live is due at once.
        recovery: { workflowGraceMs: 0 },
      });
      instances.push(mastra);

      // 300 active default-engine runs other processes drive. A nested run holds no lease of its own: its
      // parent's lease covers it.
      for (let i = 0; i < 160; i++) {
        await persistRun('plain', `plain-${i}`, { status: i % 4 === 0 ? 'waiting' : 'running' });
        await keepLive(`plain-${i}`);
      }

      for (let i = 0; i < 70; i++) {
        await persistRun('parent', `parent-${i}`);
        await keepLive(`parent-${i}`);
        await persistRun('child', `child-${i}`, { parent: { workflowId: 'parent', runId: `parent-${i}` } });
      }

      // Evented runs whose instance crashed: the broker redelivers their pending messages.
      for (let i = 0; i < 80; i++) {
        await persistRun('evented', `evented-${i}`, { status: i % 4 === 0 ? 'waiting' : 'running' });
      }

      const reads = await countReads(instanceStorage);
      await mastra.restartAllActiveWorkflowRuns();

      expect(reads.snapshotReads).toEqual([]);
      expect(reads.listings.map(listing => listing.workflowName).sort()).toEqual(
        ['child', 'child', 'parent', 'parent', 'plain', 'plain'].sort(),
      );
      expect(reads.listings.every(listing => listing.summary === true)).toBe(true);
      expect(
        reads.listings.flatMap(listing => listing.snapshots).some(snapshot => 'context' in (snapshot as object)),
      ).toBe(false);
      // The nested runs are left to their active parents, so 230 runs are checked, at most a hundred per read.
      expect(reads.ownershipReads).toHaveLength(3);
      expect(reads.ownershipReads.every(runIds => runIds.length <= 100)).toBe(true);
      const read = reads.ownershipReads.flat();
      expect(read).toHaveLength(230);
      expect(read.some(runId => runId.startsWith('evented-'))).toBe(false);
      expect(executions).toEqual([]);

      // Another process crashed while running `stopped`: it holds no lease.
      await persistRun('plain', 'stopped');
      reads.snapshotReads.length = 0;
      await mastra.restartAllActiveWorkflowRuns();

      expect(executions).toEqual(['stopped']);
      // All of them for the restarted run: `createRun()` reads the stored run and its status, and
      // `restart()` loads the snapshot it resumes from.
      expect(reads.snapshotReads).toEqual(['stopped', 'stopped', 'stopped']);
    }, 60_000);

    /**
     * A recovering instance with `count` default-engine workflows `wf-<i>`, each with one stopped run `run-<i>`,
     * and the evented workflows `evented` names, each with one stopped run `<name>-run`.
     */
    async function manyWorkflows(count: number, executions: string[], evented: string[] = []) {
      const store = (await getStorage().getStore('workflows'))!;
      await store.dangerouslyClearAll();
      const names = Array.from({ length: count }, (_, i) => `wf-${i}`);
      const mastra = new Mastra({
        logger: false,
        storage: getStorage(),
        workflows: Object.fromEntries([
          ...names.map(name => [name, oneStep(name, 'default', executions)]),
          ...evented.map(name => [name, oneStep(name, 'evented', executions)]),
        ]),
        recovery: { workflowGraceMs: 0 },
      });
      instances.push(mastra);
      for (const [i, name] of names.entries()) {
        await persistRun(name, `run-${i}`, { status: i % 2 === 0 ? 'running' : 'waiting' });
      }
      for (const name of evented) {
        await persistRun(name, `${name}-run`);
      }

      return { mastra, names };
    }

    // Listing every workflow at once fills the store's connection pool on the leader and delays its other
    // reads, such as the ownership checks of the durable steps it follows.
    it('lists the active runs of at most five workflows at a time and still lists and restarts every one', async () => {
      const executions: string[] = [];
      const { mastra, names } = await manyWorkflows(12, executions, ['evented-0']);
      const reads = await countReads(getStorage());

      // The default pubsub doesn't redeliver, so the evented pass lists too, at the same time as the default one.
      await mastra.restartAllActiveWorkflowRuns();

      const listed = [...names, 'evented-0'];
      expect(
        reads.listings
          .filter(({ workflowName }) => listed.includes(workflowName!))
          .map(({ workflowName, status }) => `${workflowName}:${status}`)
          .sort(),
      ).toEqual(listed.flatMap(name => [`${name}:running`, `${name}:waiting`]).sort());
      expect(reads.listingsInFlight.max).toBeLessThanOrEqual(5);
      expect(executions.filter(runId => runId.startsWith('run-')).sort()).toEqual(
        names.map((_, i) => `run-${i}`).sort(),
      );
    });

    it('restarts the runs of the other workflows when listing one workflow fails', async () => {
      const executions: string[] = [];
      const { mastra, names } = await manyWorkflows(6, executions);
      const store = (await getStorage().getStore('workflows'))!;
      const list = store.listWorkflowRuns.bind(store);
      vi.spyOn(store, 'listWorkflowRuns').mockImplementation(async (args = {}) => {
        if (args.workflowName === 'wf-0') {
          throw new Error('connection reset');
        }

        return list(args);
      });

      await mastra.restartAllActiveWorkflowRuns();

      expect([...executions].sort()).toEqual(names.slice(1).map((_, i) => `run-${i + 1}`));
    });
  });
}
