import { describe, expect, it, vi } from 'vitest';
import { loadSnapshotForResume } from './load-snapshot-for-resume';

function storeReturning(sequence: (string | null)[]) {
  const loadWorkflowSnapshot = vi.fn(async () => {
    const next = sequence.length > 1 ? sequence.shift()! : sequence[0]!;
    return next === null ? null : { status: next, runId: 'run-1' };
  });
  return { loadWorkflowSnapshot };
}

const args = { workflowName: 'wf', runId: 'run-1', timeoutMs: 500 };

describe('loadSnapshotForResume', () => {
  it('returns immediately when the run is already suspended', async () => {
    const workflowsStore = storeReturning(['suspended']);

    const snapshot = await loadSnapshotForResume({ workflowsStore, ...args });

    expect(snapshot?.status).toBe('suspended');
    expect(workflowsStore.loadWorkflowSnapshot).toHaveBeenCalledTimes(1);
  });

  it('waits for a suspend write that is still in flight', async () => {
    // The reporter's failure: approval reads the row while the (slow) suspend
    // write has not landed, so the run still looks `running`.
    const workflowsStore = storeReturning(['running', 'running', 'suspended']);

    const snapshot = await loadSnapshotForResume({ workflowsStore, ...args });

    expect(snapshot?.status).toBe('suspended');
    expect(workflowsStore.loadWorkflowSnapshot.mock.calls.length).toBeGreaterThan(1);
  });

  it('waits when the snapshot row is not visible yet', async () => {
    const workflowsStore = storeReturning([null, null, 'suspended']);

    const snapshot = await loadSnapshotForResume({ workflowsStore, ...args });

    expect(snapshot?.status).toBe('suspended');
  });

  it('gives up immediately on a terminal status rather than burning the budget', async () => {
    const workflowsStore = storeReturning(['success']);

    const started = Date.now();
    const snapshot = await loadSnapshotForResume({ workflowsStore, ...args });

    expect(snapshot?.status).toBe('success');
    expect(workflowsStore.loadWorkflowSnapshot).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(args.timeoutMs);
  });

  it('returns the last seen snapshot once the budget expires so callers can still error', async () => {
    const workflowsStore = storeReturning(['running']);

    const snapshot = await loadSnapshotForResume({ workflowsStore, ...args, timeoutMs: 150 });

    expect(snapshot?.status).toBe('running');
  });

  it('returns undefined when there is no workflows store', async () => {
    await expect(loadSnapshotForResume({ workflowsStore: undefined, ...args })).resolves.toBeUndefined();
  });
});
