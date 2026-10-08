import { describe, expect, it, vi } from 'vitest';

import { WorkflowsSpanner } from './index';

const abortedError = () => Object.assign(new Error('10 ABORTED: Transaction was aborted.'), { code: 10 });

/**
 * Builds a mock Spanner `database` that runs one transaction attempt per entry
 * in `attempts`. Each attempt reads a snapshot with the given status; an
 * attempt marked `abortOnCommit` fails its commit with ABORTED, so
 * `runWithAbortRetry` runs the next attempt.
 */
function createMockDatabase(attempts: Array<{ status: string; abortOnCommit?: boolean }>) {
  let attempt = 0;
  const database = {
    // Column-metadata lookup used by SpannerDB.update; returning empty makes the
    // update pass the record through unfiltered.
    run: vi.fn(async () => [[]]),
    runTransactionAsync: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
      const { status, abortOnCommit } = attempts[attempt++]!;
      const tx = {
        run: vi.fn(async () => [[{ snapshot: { runId: 'run-1', status, context: {} } }]]),
        runUpdate: vi.fn(async () => [1]),
        commit: vi.fn(async () => {
          if (abortOnCommit) throw abortedError();
        }),
        rollback: vi.fn(async () => {}),
      };
      await cb(tx);
    }),
  };
  return database;
}

describe('WorkflowsSpanner.updateWorkflowState', () => {
  it('reports no win when the attempt that matched expectedStatus aborted and the retry no longer matches', async () => {
    // The first attempt sees the run suspended, but its commit aborts. By the
    // retry, a concurrent resume has committed and the run is running.
    const database = createMockDatabase([{ status: 'suspended', abortOnCommit: true }, { status: 'running' }]);
    const workflows = new WorkflowsSpanner({ database: database as any });

    const result = await workflows.updateWorkflowState({
      workflowName: 'wf',
      runId: 'run-1',
      opts: { status: 'running', expectedStatus: 'suspended' } as any,
    });

    expect(database.runTransactionAsync).toHaveBeenCalledTimes(2);
    expect(result).toBeUndefined();
  });

  it('reports the win when the retry still matches expectedStatus', async () => {
    const database = createMockDatabase([{ status: 'suspended', abortOnCommit: true }, { status: 'suspended' }]);
    const workflows = new WorkflowsSpanner({ database: database as any });

    const result = await workflows.updateWorkflowState({
      workflowName: 'wf',
      runId: 'run-1',
      opts: { status: 'running', expectedStatus: 'suspended' } as any,
    });

    expect(database.runTransactionAsync).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe('running');
  });
});
