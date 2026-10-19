import { expect, vi } from 'vitest';
import { cloneRunData } from '../storage/domains/workflows/inmemory';
import { summarizeStepResult } from '../storage/domains/workflows/journal';
import { MockStore } from '../storage/mock';
import { isStepResultStub, RunJournal } from './run-journal';
import { createDefaultEngineTestSuite } from './test-utils/default-engine-suite';
import type { WorkflowRunState } from './types';

// The shared suite again, with every workflow on storage v2. It's kept out of
// workflow.test.ts because each run of the suite needs most of a worker's heap.

// These runs share one store and rely on real, unique run ids.
vi.unmock('crypto');
vi.unmock('node:crypto');

/**
 * Checks every storage v2 engine write: the run read back right after it must match the
 * snapshot the engine wrote, which `RunJournal.write` is the last to see whole. A step's start
 * write (`stepIds` set) can overlap other writes, so it sends only its steps and the header, and
 * only those are checked. Returns the mismatches found so far.
 */
function checkStorageV2Writes(): string[] {
  const mismatches: string[] = [];
  const write = RunJournal.prototype.write;
  RunJournal.prototype.write = async function (this: RunJournal, args) {
    const { store, workflowName, runId } = this;
    // A foreach iteration's start write names no step and writes nothing.
    if (!store || args.stepIds?.length === 0) return write.call(this, args);
    const { context } = args.snapshot;
    // Cloning makes plain copies of stubs, so note them first.
    const stubbed = new Set(Object.keys(context).filter(stepId => isStepResultStub(context[stepId])));
    const expected = cloneRunData(args.snapshot);
    // The in-memory store applies a write, and reads a run, before its first await. So
    // `stored` is what this write left, even while other writes to the run are in flight.
    const written = write.call(this, args);
    const stored = store.loadWorkflowRun({ workflowName, runId, successfulSteps: 'full' });
    await written;
    const run = await stored;
    const problem = storageV2WriteMismatch(
      expected,
      run && ({ ...run.header, context: run.steps, value: run.state } as WorkflowRunState),
      stubbed,
      args.stepIds,
    );
    if (problem) mismatches.push(`${workflowName}/${runId} (${expected.status}): ${problem}`);
  };
  return mismatches;
}

function storageV2WriteMismatch(
  expected: WorkflowRunState,
  stored: WorkflowRunState | null,
  stubbed: Set<string>,
  stepIds: readonly string[] | undefined,
): string | undefined {
  if (!stored) return 'the run was not stored';
  const { context: expectedContext, value: expectedState, ...expectedRest } = expected;
  const { context: storedContext, value: storedState, ...storedRest } = stored;
  try {
    expect(storedRest).toEqual(expectedRest);
    if (!stepIds) expect(storedState, 'state').toEqual(expectedState);
    for (const stepId of stepIds ?? Object.keys(expectedContext)) {
      // A stub holds only the stored result's summary.
      const actual = stubbed.has(stepId) ? summarizeStepResult(storedContext[stepId] as any) : storedContext[stepId];
      expect(actual, `step ${stepId}`).toEqual(expectedContext[stepId]);
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

/**
 * Makes the store's v1 run methods throw when asked for a storage v2 run, so any v2 path that
 * still reaches them fails the suite. Engine errors can end up in a failed result instead of
 * failing the test, so the calls are also returned for `afterEach`.
 */
function rejectV1MethodsForStorageV2(storage: MockStore): string[] {
  const calls: string[] = [];
  const store = storage.stores.workflows!;
  for (const method of [
    'loadWorkflowSnapshot',
    'getWorkflowRunById',
    'updateWorkflowState',
    'persistWorkflowSnapshot',
  ] as const) {
    const original = (store[method] as (args: { workflowName: string; storageVersion?: 1 | 2 }) => unknown).bind(store);
    (store as any)[method] = (args: { workflowName: string; storageVersion?: 1 | 2 }) => {
      if (args.storageVersion === 2) {
        calls.push(`${method}(${args.workflowName})`);
        throw new Error(`${method} was called with storageVersion: 2`);
      }
      return original(args);
    };
  }
  return calls;
}

const storageV2Mismatches = checkStorageV2Writes();
const storage = new MockStore();
const v1MethodCalls = rejectV1MethodsForStorageV2(storage);

createDefaultEngineTestSuite({
  name: 'Workflow (Default Engine, storage v2)',
  storage,
  storageVersion: 2,
  skipTests: {
    // Sync getStepResult throws on storage v2 runs.
    getStepResultSync: true,
  },
  afterEach: async () => {
    const calls = v1MethodCalls.splice(0);
    const found = storageV2Mismatches.splice(0);
    if (calls.length) throw new Error(`Storage v2 runs reached v1 store methods:\n${calls.join('\n')}`);
    if (found.length) throw new Error(`Storage v2 writes didn't match their snapshots:\n${found.join('\n')}`);
  },
});
