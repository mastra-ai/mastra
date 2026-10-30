import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { START_ASYNC_WORKFLOW_ROUTE } from '@mastra/server/handlers/workflows';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// A 4xx thrown by a route handler is a client error and must not be printed as a server fault.
// https://github.com/mastra-ai/mastra/issues/28760
describe('Koa client error logging', () => {
  let server: Server | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close(err => (err ? reject(err) : resolve())));
      server = null;
    }
  });

  async function startServer() {
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

    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });
    (adapter as any).registerErrorMiddleware();
    app.use(bodyParser());
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, START_ASYNC_WORKFLOW_ROUTE, { prefix: '' });

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const send = () =>
      fetch(`http://localhost:${port}/workflows/schema-workflow/start-async`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputData: {} }),
      });
    return { app, logger, send };
  }

  it('responds 400 and does not log the failure as a server error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger, send } = await startServer();

    const response = await send();

    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('Invalid input data');
    expect(logger.error).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('delivers the 400 to an app error listener added after listen without console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app, send } = await startServer();
    const appListener = vi.fn();
    app.on('error', appListener);

    const response = await send();

    expect(response.status).toBe(400);
    expect(appListener).toHaveBeenCalledTimes(1);
    expect(appListener.mock.calls[0]![0]).toMatchObject({ status: 400 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('removes a once error listener after delivering the first 400', async () => {
    const { app, send } = await startServer();
    const onceListener = vi.fn();
    app.once('error', onceListener);

    expect((await send()).status).toBe(400);
    expect((await send()).status).toBe(400);

    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(app.listeners('error')).not.toContain(onceListener);
  });
});
