import { describe, it, expect } from 'vitest';
import {
  fetchApi,
  fetchJson,
  startWorkflow,
  startWorkflowSync,
  resumeWorkflowSync,
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
      expect(lastResult.payload.output).toEqual({ message: 'Hey Charlie! Goodbye, Charlie!' });
    });
  });

  // Note: /restart-async (blocking variant) is not tested here because it blocks until
  // the restarted workflow completes. Since cancelable-workflow has a 60s sleep, this
  // would either time out or require aborting — making the test unreliable.
  // The fire-and-forget /restart endpoint is tested in run-management.test.ts.
});
