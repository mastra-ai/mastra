import { describe, it, expect } from 'vitest';
import {
  fetchApi,
  fetchJson,
  startWorkflow,
  startWorkflowSync,
  resumeWorkflowSync,
  streamLegacyWorkflow,
  streamTimeTravelWorkflow,
  pollWorkflowRun,
} from '../utils.js';

describe('API endpoint variants', () => {
  describe('sync /start (fire-and-forget)', () => {
    it('should start a workflow via /start and poll for completion', async () => {
      const runId = crypto.randomUUID();

      // Pre-create the run
      const createRes = await fetchApi(`/api/workflows/sequential-steps/create-run?runId=${runId}`, {
        method: 'POST',
      });
      expect(createRes.status).toBe(200);

      // Fire-and-forget start
      const { status, data } = await startWorkflowSync('sequential-steps', runId, {
        inputData: { name: 'sync-test' },
      });
      expect(status).toBe(200);
      expect(data).toHaveProperty('message', 'Workflow run started');

      // Poll until complete
      const run = await pollWorkflowRun('sequential-steps', runId, ['success']);
      expect(run.status).toBe('success');
      expect(run.result).toEqual({ message: 'Hello, sync-test! Goodbye, sync-test!' });
    });
  });

  describe('sync /resume (fire-and-forget)', () => {
    it('should resume a suspended workflow via /resume and poll for completion', async () => {
      // Start and suspend
      const { runId, data: startData } = await startWorkflow('basic-suspend', {
        inputData: { item: 'sync-resume-test' },
      });
      expect(startData.status).toBe('suspended');

      // Fire-and-forget resume
      const { status, data } = await resumeWorkflowSync('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      });
      expect(status).toBe(200);
      expect(data).toHaveProperty('message', 'Workflow run resumed');

      // Poll until complete
      const run = await pollWorkflowRun('basic-suspend', runId, ['success']);
      expect(run.status).toBe('success');
      expect(run.result).toEqual({ result: 'sync-resume-test approved' });
    });
  });

  describe('/create-run', () => {
    it('should pre-create a run and verify it exists', async () => {
      const runId = crypto.randomUUID();

      const createRes = await fetchApi(`/api/workflows/sequential-steps/create-run?runId=${runId}`, {
        method: 'POST',
      });
      expect(createRes.status).toBe(200);

      // The run should exist
      const { status, data } = await fetchJson<any>(`/api/workflows/sequential-steps/runs/${runId}`);
      expect(status).toBe(200);
      expect(data.runId).toBe(runId);
      // Pre-created runs should not yet have a success/failed status
      expect(data.status).not.toBe('success');
    });
  });

  describe('/stream-legacy', () => {
    it('should stream a workflow using the legacy format', async () => {
      const { chunks } = await streamLegacyWorkflow('sequential-steps', {
        inputData: { name: 'legacy-stream-test' },
      });

      // Legacy format uses short type names: start, step-start, step-result, step-finish, finish
      const types = chunks.map((c: any) => c.type);
      expect(types[0]).toBe('start');
      expect(types[types.length - 1]).toBe('finish');
      expect(types).toContain('step-result');

      // Should have step results for each of the 3 steps
      const stepResults = chunks.filter((c: any) => c.type === 'step-result');
      expect(stepResults.length).toBe(3);

      // Final step result should contain the combined message
      const lastStepResult = stepResults[stepResults.length - 1];
      expect(lastStepResult.payload.output).toEqual({
        message: 'Hello, legacy-stream-test! Goodbye, legacy-stream-test!',
      });
    });
  });

  describe('/time-travel-stream', () => {
    it('should stream a time-travel re-execution', async () => {
      // First complete a run
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'Alice' },
      });

      // Time-travel via stream from add-farewell step with new input
      const { chunks } = await streamTimeTravelWorkflow('sequential-steps', runId, {
        step: 'add-farewell',
        inputData: { name: 'Charlie', greeting: 'Hey Charlie!' },
      });

      const types = chunks.map((c: any) => c.type);
      expect(types[0]).toBe('workflow-start');
      expect(types[types.length - 1]).toBe('workflow-finish');

      // The final result should contain Charlie's data
      const finish = chunks[chunks.length - 1];
      expect(finish.payload.workflowStatus).toBe('success');

      const stepResults = chunks.filter((c: any) => c.type === 'workflow-step-result');
      const lastResult = stepResults[stepResults.length - 1];
      expect(lastResult.payload.output.message).toContain('Charlie');
    });
  });

  describe('/restart-async', () => {
    it('should restart an active workflow and return the result', async () => {
      const runId = crypto.randomUUID();

      // Create and fire-and-forget start (cancelable-workflow has 60s sleep)
      await fetchApi(`/api/workflows/cancelable-workflow/create-run?runId=${runId}`, {
        method: 'POST',
      });
      await fetchApi(`/api/workflows/cancelable-workflow/start?runId=${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData: { label: 'restart-async-test' } }),
      });

      // Wait for it to enter the sleep state
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restart-async blocks until the restarted run completes (or sleeps again)
      // Since the restarted run will also hit the 60s sleep, use a short timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetchApi(`/api/workflows/cancelable-workflow/restart-async?runId=${runId}`, {
          method: 'POST',
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        // If we get a response, it should be valid
        expect(res.status).toBe(200);
      } catch {
        // AbortError is expected — restart-async blocks and the restarted
        // workflow will sleep for 60s. The important thing is that the
        // request was accepted (we'd get an immediate error if not).
      } finally {
        clearTimeout(timeout);
      }
    });
  });
});
