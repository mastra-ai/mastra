import { describe, it, expect } from 'vitest';
import { startWorkflow, resumeWorkflow, getWorkflowRun } from '../utils.js';

describe('concurrent suspend/resume', () => {
  it('should resume both parallel branches simultaneously', async () => {
    const { runId } = await startWorkflow('parallel-suspend', {
      inputData: { value: 1 },
    });

    // Resume both branches at the same time
    const [resultA, resultB] = await Promise.all([
      resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-a',
        resumeData: { dataA: 'concurrent-a' },
      }),
      resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-b',
        resumeData: { dataB: 'concurrent-b' },
      }),
    ]);

    // Neither response should be a server error
    expect(resultA.status).toBeLessThan(500);
    expect(resultB.status).toBeLessThan(500);

    // Each response should be either 'success' or 'suspended' — never 'failed'
    const results = [resultA.data, resultB.data];
    for (const r of results) {
      expect(['success', 'suspended']).toContain(r.status);
    }

    // At least one should complete successfully with the full result
    const successResult = results.find(r => r.status === 'success');
    expect(successResult).toBeDefined();
    expect(successResult.result).toEqual({
      'suspend-branch-a': { branchA: 'concurrent-a' },
      'suspend-branch-b': { branchB: 'concurrent-b' },
    });

    // Verify final run state is definitely success with both branches
    const { data: finalRun } = await getWorkflowRun('parallel-suspend', runId);
    expect(finalRun.status).toBe('success');
    expect(finalRun.result).toEqual({
      'suspend-branch-a': { branchA: 'concurrent-a' },
      'suspend-branch-b': { branchB: 'concurrent-b' },
    });
  });

  it('should handle concurrent runs with independent suspend/resume', async () => {
    // Start 3 independent runs of the same suspend workflow
    const [run1, run2, run3] = await Promise.all([
      startWorkflow('basic-suspend', { inputData: { item: 'item-1' } }),
      startWorkflow('basic-suspend', { inputData: { item: 'item-2' } }),
      startWorkflow('basic-suspend', { inputData: { item: 'item-3' } }),
    ]);

    expect(run1.data.status).toBe('suspended');
    expect(run2.data.status).toBe('suspended');
    expect(run3.data.status).toBe('suspended');

    // Resume all 3 concurrently with different data
    const [resume1, resume2, resume3] = await Promise.all([
      resumeWorkflow('basic-suspend', run1.runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      }),
      resumeWorkflow('basic-suspend', run2.runId, {
        step: 'await-approval',
        resumeData: { approved: false },
      }),
      resumeWorkflow('basic-suspend', run3.runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      }),
    ]);

    // Each run should complete with its own data — no cross-contamination
    expect(resume1.data.status).toBe('success');
    expect(resume1.data.result).toEqual({ result: 'item-1 approved' });

    expect(resume2.data.status).toBe('success');
    expect(resume2.data.result).toEqual({ result: 'item-2 rejected' });

    expect(resume3.data.status).toBe('success');
    expect(resume3.data.result).toEqual({ result: 'item-3 approved' });
  });
});
