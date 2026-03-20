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
    it('should handle resuming a completed (non-suspended) run', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'completed-resume-test' },
      });

      // Try to resume a completed run — should error or return non-success
      const { status, data } = await resumeWorkflow('sequential-steps', runId, {
        step: 'add-greeting',
        resumeData: {},
      });

      // The server should indicate this is not valid
      // Could be an error status or an error in the response body
      const isError = status >= 400 || data.error || data.status === 'failed';
      expect(isError).toBe(true);
    });

    it('should handle time-travel with non-existent step', async () => {
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

      const isError = status >= 400 || data.error || data.status === 'failed';
      expect(isError).toBe(true);
    });
  });

  describe('foreach edge cases', () => {
    it('should handle foreach with empty array', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: [] },
      });

      // Should complete successfully with empty result
      expect(data.status).toBe('success');
    });

    it('should handle foreach with single item', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: ['only'] },
      });

      expect(data.status).toBe('success');
      expect(JSON.stringify(data.result)).toContain('ONLY');
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

      // Each run should have its own result
      expect(run1.data.result.message).toContain('concurrent-1');
      expect(run2.data.result.message).toContain('concurrent-2');
      expect(run3.data.result.message).toContain('concurrent-3');

      // Each run should have a unique runId
      const ids = new Set([run1.runId, run2.runId, run3.runId]);
      expect(ids.size).toBe(3);
    });
  });
});
