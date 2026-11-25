import { Mastra } from '@mastra/core';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { START_ASYNC_WORKFLOW_ROUTE } from '@mastra/server/handlers/workflows';
import { Elysia } from 'elysia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// A 4xx thrown by a route handler is a client error and must not be logged as a server fault.
// https://github.com/mastra-ai/mastra/issues/28760
describe('Elysia client error logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds 400 and does not log the failure as a server error', async () => {
    const step = createStep({
      id: 'echo',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'schema-workflow',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string() }),
    })
      .then(step)
      .commit();
    const mastra = new Mastra({ workflows: { 'schema-workflow': workflow } });
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    vi.spyOn(mastra, 'getLogger').mockReturnValue(logger as any);

    const app = new Elysia();
    const adapter = new MastraServer({ app, mastra });
    app.derive(adapter.createContextMiddleware());
    await adapter.registerRoute(app as any, START_ASYNC_WORKFLOW_ROUTE, { prefix: '' });

    const response = await app.handle(
      new Request('http://localhost/workflows/schema-workflow/start-async', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputData: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Invalid input data');
    expect(logger.error).not.toHaveBeenCalled();
  });
});
