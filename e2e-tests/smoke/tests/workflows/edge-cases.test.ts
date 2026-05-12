import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson, startWorkflow, resumeWorkflow } from '../utils.js';

describe('edge cases', () => {
  describe('404 errors', () => {
    it('should return 404 for non-existent workflow', async () => {
      const res = await fetchApi('/api/workflows/does-not-exist/start-async?runId=' + crypto.randomUUID(), {
        method: 'POST',
        body: JSON.stringify({ inputData: {} }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent run', async () => {
      const res = await fetchApi(`/api/workflows/sequential-steps/runs/${crypto.randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent workflow metadata', async () => {
      const res = await fetchApi('/api/workflows/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('invalid operations', () => {
    it('should return 500 when resuming a completed (non-suspended) run', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'completed-resume-test' },
      });

      const { status, data } = await resumeWorkflow('sequential-steps', runId, {
        step: 'add-greeting',
        resumeData: {},
      });

      expect(status).toBe(500);
      expect(data.error).toBe('This workflow run was not suspended');
    });

    it('should return 500 when time-traveling to non-existent step', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'bad-step-test' },
      });

      const { status, data } = await fetchJson<any>(
        `/api/workflows/sequential-steps/time-travel-async?runId=${runId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            step: 'nonexistent-step',
            inputData: { name: 'test' },
          }),
        },
      );

      expect(status).toBe(500);
      expect(data.error).toContain("Time travel target step not found in execution graph: 'nonexistent-step'");
    });
  });

  describe('foreach edge cases', () => {
    it('should handle foreach with empty array', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: [] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual([]);
    });

    it('should handle foreach with single item', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: ['only'] },
      });

      expect(data.status).toBe('success');
      expect(data.result).toEqual([{ processed: 'ONLY' }]);
    });
  });

  describe('concurrent runs', () => {
    it('should handle multiple concurrent runs of the same workflow', async () => {
      // Start 3 runs in parallel
      const [run1, run2, run3] = await Promise.all([
        startWorkflow('sequential-steps', { inputData: { name: 'concurrent-1' } }),
        startWorkflow('sequential-steps', { inputData: { name: 'concurrent-2' } }),
        startWorkflow('sequential-steps', { inputData: { name: 'concurrent-3' } }),
      ]);

      expect(run1.data.status).toBe('success');
      expect(run2.data.status).toBe('success');
      expect(run3.data.status).toBe('success');

      // Each run should have its own isolated result
      expect(run1.data.result).toEqual({ message: 'Hello, concurrent-1! Goodbye, concurrent-1!' });
      expect(run2.data.result).toEqual({ message: 'Hello, concurrent-2! Goodbye, concurrent-2!' });
      expect(run3.data.result).toEqual({ message: 'Hello, concurrent-3! Goodbye, concurrent-3!' });

      // Each run should have a unique runId
      const ids = new Set([run1.runId, run2.runId, run3.runId]);
      expect(ids.size).toBe(3);
    });
  });
});
