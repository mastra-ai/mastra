import { describe, it, expect } from 'vitest';
import { fetchJson, fetchApi, startWorkflow } from '../utils.js';

describe('run management', () => {
  describe('workflow discovery', () => {
    it('should list all registered workflows', async () => {
      const { data } = await fetchJson<Record<string, any>>('/api/workflows');

      expect(data).toHaveProperty('sequential-steps');
      expect(data).toHaveProperty('branch-workflow');
      expect(data).toHaveProperty('basic-suspend');
      expect(data).toHaveProperty('cancelable-workflow');
    });

    it('should get single workflow metadata', async () => {
      const { data } = await fetchJson<any>('/api/workflows/sequential-steps');

      expect(data).toHaveProperty('steps');
      expect(data).toHaveProperty('stepGraph');
    });
  });

  describe('run CRUD', () => {
    it('should list runs after starting a workflow', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-list-test' },
      });

      const { data } = await fetchJson<any>('/api/workflows/sequential-steps/runs');

      expect(data.runs).toBeDefined();
      expect(data.runs.length).toBeGreaterThan(0);

      const run = data.runs.find((r: any) => r.runId === runId);
      expect(run).toBeDefined();
    });

    it('should get run details by ID', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-detail-test' },
      });

      const { data } = await fetchJson<any>(`/api/workflows/sequential-steps/runs/${runId}`);

      expect(data.runId).toBe(runId);
      expect(data.status).toBe('success');
      expect(data.result).toBeDefined();
    });

    it('should delete a run', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-delete-test' },
      });

      const deleteRes = await fetchApi(`/api/workflows/sequential-steps/runs/${runId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);

      // Verify it's gone
      const getRes = await fetchApi(`/api/workflows/sequential-steps/runs/${runId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('cancel', () => {
    it('should cancel a running workflow', async () => {
      // cancelable-workflow has a 60s sleep.
      // start-async blocks, so we use create-run + /start (fire-and-forget).
      const runId = crypto.randomUUID();

      // Create the run
      const createRes = await fetchApi(`/api/workflows/cancelable-workflow/create-run?runId=${runId}`, {
        method: 'POST',
      });
      expect(createRes.status).toBe(200);

      // Fire-and-forget start
      const startRes = await fetchApi(`/api/workflows/cancelable-workflow/start?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({ inputData: { label: 'cancel-test' } }),
      });
      expect(startRes.status).toBe(200);

      // Give it a moment to enter the sleep state
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cancel
      const cancelRes = await fetchApi(`/api/workflows/cancelable-workflow/runs/${runId}/cancel`, {
        method: 'POST',
      });
      expect(cancelRes.status).toBe(200);

      // Verify the run is cancelled
      const { data } = await fetchJson<any>(`/api/workflows/cancelable-workflow/runs/${runId}`);
      expect(data.status).toBe('canceled');
    });
  });

  describe('time-travel', () => {
    it('should re-execute from a specific step with new input', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'Alice' },
      });

      const { data } = await fetchJson<any>(
        `/api/workflows/sequential-steps/time-travel-async?runId=${runId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            step: 'add-farewell',
            inputData: { name: 'Bob', greeting: 'Hi Bob!' },
          }),
        },
      );

      expect(data.status).toBe('success');
      expect(JSON.stringify(data.result)).toContain('Bob');
    });
  });

  describe('restart', () => {
    it('should restart an active workflow run', async () => {
      // cancelable-workflow has a 60s sleep, keeping it in an active state.
      // Use create-run + fire-and-forget /start so we don't block.
      const runId = crypto.randomUUID();

      // Create the run
      const createRes = await fetchApi(`/api/workflows/cancelable-workflow/create-run?runId=${runId}`, {
        method: 'POST',
      });
      expect(createRes.status).toBe(200);

      // Fire-and-forget start
      const startRes = await fetchApi(`/api/workflows/cancelable-workflow/start?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({ inputData: { label: 'restart-test' } }),
      });
      expect(startRes.status).toBe(200);

      // Give it a moment to enter the sleep step (becomes "active")
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restart (fire-and-forget) — the run should be re-created and started fresh
      const restartRes = await fetchApi(`/api/workflows/cancelable-workflow/restart?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(restartRes.status).toBe(200);

      const restartBody = await restartRes.json();
      expect(restartBody).toHaveProperty('message', 'Workflow run restarted');
    });
  });
});
