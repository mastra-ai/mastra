import type { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';
import { createTestServerContext } from './test-utils';
import { RESTART_ALL_ACTIVE_WORKFLOW_RUNS_ROUTE } from './workflows';

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
