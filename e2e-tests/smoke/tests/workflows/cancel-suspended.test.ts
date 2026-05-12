import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson, startWorkflow, resumeWorkflow } from '../utils.js';

describe('cancel suspended workflow', () => {
  it('should cancel a workflow in suspended state', async () => {
    // Start a workflow that suspends
    const { runId } = await startWorkflow('basic-suspend', {
      inputData: { item: 'cancel-me' },
    });

    // Verify it's suspended
    const { data: runData } = await fetchJson<any>(`/api/workflows/basic-suspend/runs/${runId}`);
    expect(runData.status).toBe('suspended');

    // Cancel the suspended run
    const cancelRes = await fetchApi(`/api/workflows/basic-suspend/runs/${runId}/cancel`, {
      method: 'POST',
    });
    expect(cancelRes.status).toBe(200);

    // Verify it's cancelled
    const { data: afterCancel } = await fetchJson<any>(`/api/workflows/basic-suspend/runs/${runId}`);
    expect(afterCancel.status).toBe('canceled');
  });

  it('should not be resumable after cancellation', async () => {
    const { runId } = await startWorkflow('basic-suspend', {
      inputData: { item: 'cancel-then-resume' },
    });

    // Cancel the suspended run
    await fetchApi(`/api/workflows/basic-suspend/runs/${runId}/cancel`, {
      method: 'POST',
    });

    // Attempt to resume the cancelled run — should get 500 with clear error
    const { status, data } = await resumeWorkflow('basic-suspend', runId, {
      step: 'await-approval',
      resumeData: { approved: true },
    });

    expect(status).toBe(500);
    expect(data.error).toBe('This workflow run was not suspended');
  });
});
