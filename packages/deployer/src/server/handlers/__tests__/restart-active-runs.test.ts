import type { Mastra } from '@mastra/core/mastra';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { restartAllActiveWorkflowRunsHandler } from '../restart-active-runs';

function createContext(mastra: Mastra) {
  return {
    get: vi.fn(() => mastra),
    json: vi.fn(payload => new Response(JSON.stringify(payload))),
  } as unknown as Context;
}

describe('restartAllActiveWorkflowRunsHandler', () => {
  it('logs a rejected background workflow restart without failing the request', async () => {
    const error = new Error('storage unavailable');
    const logger = { error: vi.fn() };
    const mastra = {
      restartAllActiveWorkflowRuns: vi.fn(() => Promise.reject(error)),
      getLogger: vi.fn(() => logger),
      recoveryConfig: undefined,
    } as unknown as Mastra;

    const response = await restartAllActiveWorkflowRunsHandler(createContext(mastra));

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to restart active workflow runs during server startup', {
        error,
      });
    });
  });

  it('logs a rejected durable-agent recovery without failing the request', async () => {
    const error = new Error('recovery unavailable');
    const logger = { error: vi.fn() };
    const mastra = {
      restartAllActiveWorkflowRuns: vi.fn(() => Promise.resolve()),
      recoverAllDurableAgents: vi.fn(() => Promise.reject(error)),
      getLogger: vi.fn(() => logger),
      recoveryConfig: { durableAgents: 'auto' },
    } as unknown as Mastra;

    const response = await restartAllActiveWorkflowRunsHandler(createContext(mastra));

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Failed to recover durable agent runs during server startup', {
        error,
      });
    });
  });
});
