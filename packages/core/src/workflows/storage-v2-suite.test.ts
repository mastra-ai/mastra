import { expect, vi } from 'vitest';
import { cloneRunData } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createDefaultEngineTestSuite } from './test-utils/default-engine-suite';
import type { WorkflowRunState } from './types';

// The shared suite again, with every workflow on storage v2. It's kept out of
// workflow.test.ts because each run of the suite needs most of a worker's heap.

// These runs share one store and rely on real, unique run ids.
vi.unmock('crypto');
vi.unmock('node:crypto');

/**
 * Checks every storage v2 write: the run read back right after it must match the snapshot
 * the engine wrote. Returns the mismatches found so far.
 */
function checkStorageV2Writes(storage: InstanceType<typeof MockStore>): string[] {
  const mismatches: string[] = [];
  const workflows = storage.stores.workflows!;
  const persist = workflows.persistWorkflowSnapshot.bind(workflows);
  workflows.persistWorkflowSnapshot = async args => {
    if (args.storageVersion !== 2) return persist(args);
    const expected = cloneRunData(args.snapshot);
    // The in-memory store applies a write, and reads a run, before its first await. So
    // `stored` is what this write left, even while other writes to the run are in flight.
    const write = persist(args);
    const stored = workflows.loadWorkflowSnapshot({
      workflowName: args.workflowName,
      runId: args.runId,
      storageVersion: 2,
    });
    await write;
    const problem = storageV2WriteMismatch(expected, await stored);
    if (problem) mismatches.push(`${args.workflowName}/${args.runId} (${expected.status}): ${problem}`);
  };
  return mismatches;
}

function storageV2WriteMismatch(expected: WorkflowRunState, stored: WorkflowRunState | null): string | undefined {
  if (!stored) return 'the run was not stored';
  const { context: expectedContext, ...expectedRest } = expected;
  const { context: storedContext, ...storedRest } = stored;
  try {
    expect(storedRest).toEqual(expectedRest);
    for (const [stepId, result] of Object.entries(expectedContext)) {
      expect(storedContext[stepId], `step ${stepId}`).toEqual(result);
    }
  } catch (error) {
    return (error as Error).message;
  }
  // An append can't remove a step, so a step's `running` entry stays after a write that
  // leaves it out (a parallel branch's write omits its siblings' running results).
  const extra = Object.keys(storedContext).filter(
    stepId => !(stepId in expectedContext) && storedContext[stepId]?.status !== 'running',
  );
  return extra.length ? `stored steps missing from the snapshot: ${extra.join(', ')}` : undefined;
}

const storageV2 = new MockStore();
const storageV2Mismatches = checkStorageV2Writes(storageV2);

createDefaultEngineTestSuite({
  name: 'Workflow (Default Engine, storage v2)',
  storage: storageV2,
  storageVersion: 2,
  skipTests: {
    // Sync getStepResult throws on storage v2 runs.
    getStepResultSync: true,
  },
  afterEach: async () => {
    const found = storageV2Mismatches.splice(0);
    if (found.length) throw new Error(`Storage v2 writes didn't match their snapshots:\n${found.join('\n')}`);
  },
});
