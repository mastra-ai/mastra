import { vi } from 'vitest';
import { AGENTIC_EXECUTION_WORKFLOW_ID, AGENTIC_LOOP_WORKFLOW_ID } from '../../loop/loop-builder';
import { MockStore } from '../../storage/mock';
import { createEventedEngineTestSuite } from '../test-utils/evented-engine-suite';

// The shared suite on the evented engine, with every workflow on storage v2.

vi.unmock('crypto');
vi.unmock('node:crypto');

// An agent step's own loop runs are not workflows of this suite and stay on storage v1.
const agentLoopWorkflows = new Set([AGENTIC_LOOP_WORKFLOW_ID, AGENTIC_EXECUTION_WORKFLOW_ID]);

/**
 * Records every call to the store's v1 run writes. Every workflow in this suite is on storage
 * v2, so any such call is a v2 run written to the v1 table. Engine errors can end up in a failed
 * result instead of failing the test, so the calls are checked in `afterEach`.
 */
function recordV1Writes(storage: InstanceType<typeof MockStore>): string[] {
  const calls: string[] = [];
  const store = storage.stores.workflows!;
  for (const method of ['persistWorkflowSnapshot', 'updateWorkflowResults', 'updateWorkflowState'] as const) {
    const original = (store[method] as (args: { workflowName: string; runId: string }) => unknown).bind(store);
    (store as any)[method] = (args: { workflowName: string; runId: string }) => {
      if (!agentLoopWorkflows.has(args.workflowName)) calls.push(`${method}(${args.workflowName}/${args.runId})`);
      return original(args);
    };
  }
  return calls;
}

const storage = new MockStore();
const v1Writes = recordV1Writes(storage);

createEventedEngineTestSuite({
  name: 'Workflow (Evented Engine, storage v2)',
  storage,
  storageVersion: 2,
  skipTests: {
    // Sync getStepResult throws on storage v2 runs.
    getStepResultSync: true,
    // So does reading the sync `state` field.
    stateSync: true,
  },
  afterEach: async () => {
    const calls = v1Writes.splice(0);
    if (calls.length) throw new Error(`Storage v2 runs were written to the v1 table:\n${calls.join('\n')}`);
  },
});
