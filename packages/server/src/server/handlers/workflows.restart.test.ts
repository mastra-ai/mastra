import type { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestServerContext } from './test-utils';
import { RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE, RESTART_WORKFLOW_ROUTE } from './workflows';

describe('RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE', () => {
  it('logs a rejected background restart while returning the accepted response', async () => {
    const error = new Error('storage unavailable');
    const logger = { error: vi.fn() };
    const workflow = {
      restartAllActiveWorkflowRuns: vi.fn(() => Promise.reject(error)),
    };
    const mastra = {
      getWorkflowById: vi.fn(() => workflow),
      getLogger: vi.fn(() => logger),
    } as unknown as Mastra;

    const response = await RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      workflowId: 'test-workflow',
    });

    expect(response).toEqual({ message: 'All active workflow runs restarted' });
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to restart active workflow runs', {
        error,
        workflowId: 'test-workflow',
      });
    });
  });
});

describe('RESTART_WORKFLOW_ROUTE', () => {
  it('logs a rejected background run restart while returning the accepted response', async () => {
    const error = new Error('No snapshot found for this workflow run');
    const logger = { error: vi.fn(), debug: vi.fn() };
    const run = { restart: vi.fn(() => Promise.reject(error)) };
    const workflow = {
      getWorkflowRunById: vi.fn(() => Promise.resolve({ runId: 'test-run', resourceId: undefined })),
      createRun: vi.fn(() => Promise.resolve(run)),
    };
    const mastra = {
      getWorkflowById: vi.fn(() => workflow),
      getLogger: vi.fn(() => logger),
    } as unknown as Mastra;

    const response = await RESTART_WORKFLOW_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      workflowId: 'test-workflow',
      runId: 'test-run',
    });

    expect(response).toEqual({ message: 'Workflow run restarted' });
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to restart workflow run in background', {
        error,
        workflowId: 'test-workflow',
        runId: 'test-run',
      });
    });
  });
});
