import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import type { WorkflowRunState } from '../../workflows/types';
import { DurableStepIds } from '../durable/constants';
import { formatLeaseOwner, leaseOwnerRunId, readStoredRunStatus } from '../run-ownership';

function snapshotWithStatus(runId: string, status: WorkflowRunState['status']): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {} as WorkflowRunState['context'],
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

async function mastraWithRow(workflowName: string, runId: string, status: WorkflowRunState['status']) {
  const storage = new InMemoryStore();
  const workflowsStore = await storage.getStore('workflows');
  await workflowsStore!.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshotWithStatus(runId, status) });
  return { getStorage: () => storage } as any;
}

describe('lease owner tokens', () => {
  it('round-trips holder and runId', () => {
    const owner = formatLeaseOwner('source-1', 'run-1');
    expect(owner).toBe('source-1/run-1');
    expect(leaseOwnerRunId(owner)).toBe('run-1');
  });

  it('treats a token without a holder as a legacy bare runId', () => {
    expect(leaseOwnerRunId('run-1')).toBe('run-1');
    expect(leaseOwnerRunId(undefined)).toBeUndefined();
  });

  it('splits on the first slash only, so runIds may contain slashes', () => {
    expect(leaseOwnerRunId(formatLeaseOwner('source-1', 'a/b/c'))).toBe('a/b/c');
  });
});

describe('readStoredRunStatus', () => {
  it.each([
    ['running', 'running'],
    ['pending', 'running'],
    ['waiting', 'running'],
    ['suspended', 'suspended'],
    ['paused', 'suspended'],
    ['success', 'terminal'],
    ['failed', 'terminal'],
    ['canceled', 'terminal'],
    ['tripwire', 'terminal'],
    ['bailed', 'terminal'],
  ] as const)('maps a stored %s row to %s', async (status, expected) => {
    const mastra = await mastraWithRow('agentic-loop', 'run-1', status);
    expect(await readStoredRunStatus(mastra, 'run-1')).toBe(expected);
  });

  it('reads durable agentic-loop rows', async () => {
    const mastra = await mastraWithRow(DurableStepIds.AGENTIC_LOOP, 'run-1', 'suspended');
    expect(await readStoredRunStatus(mastra, 'run-1')).toBe('suspended');
  });

  it('reports missing when no row exists', async () => {
    const mastra = await mastraWithRow('agentic-loop', 'other-run', 'running');
    expect(await readStoredRunStatus(mastra, 'run-1')).toBe('missing');
  });

  it('reports unknown without storage', async () => {
    expect(await readStoredRunStatus(undefined, 'run-1')).toBe('unknown');
    expect(await readStoredRunStatus({ getStorage: () => undefined } as any, 'run-1')).toBe('unknown');
  });

  it('reports unknown when the read throws', async () => {
    const storage = {
      getStore: async () => ({
        loadWorkflowSnapshot: async () => {
          throw new Error('storage down');
        },
      }),
    };
    expect(await readStoredRunStatus({ getStorage: () => storage } as any, 'run-1')).toBe('unknown');
  });
});
