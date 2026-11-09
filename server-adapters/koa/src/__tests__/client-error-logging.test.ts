import { errorMonitor } from 'node:events';
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

  async function startServer(configure?: (app: Koa) => void) {
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
    configure?.(app);
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

  it('delivers the 400 to a custom app.onerror set before listen', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const customOnError = vi.fn();
    const { send } = await startServer(app => {
      app.onerror = customOnError;
    });

    expect((await send()).status).toBe(400);

    expect(customOnError).toHaveBeenCalledTimes(1);
    expect(customOnError.mock.calls[0]![0]).toMatchObject({ status: 400 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('notifies errorMonitor listeners and keeps the default listener for later 5xx', async () => {
    const { app, send } = await startServer();
    const monitor = vi.fn();
    const appListener = vi.fn();
    app.on(errorMonitor, monitor);
    app.on('error', appListener);

    expect((await send()).status).toBe(400);

    expect(monitor).toHaveBeenCalledTimes(1);
    expect(appListener).toHaveBeenCalledTimes(1);
    expect(app.rawListeners('error')[0]).toBe(Koa.prototype.onerror);
  });

  // Errors thrown by middleware behind the boundary, to cover shapes the workflow route can't produce.
  async function startThrowingServer(throwError: (ctx: Koa.Context) => never, configure?: (app: Koa) => void) {
    const mastra = new Mastra({});
    const app = new Koa();
    configure?.(app);
    const adapter = new MastraServer({ app, mastra });
    (adapter as any).registerErrorMiddleware();
    app.use(ctx => throwError(ctx));

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return { send: () => fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) }) };
  }

  function throwLoggedNotImplemented(ctx: Koa.Context, error: unknown): never {
    (ctx as any)._mastraLoggedNotImplementedError = error;
    throw error;
  }

  it('keeps the 400 for a frozen client error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send } = await startThrowingServer(() => {
      throw Object.freeze(Object.assign(new Error('frozen bad request'), { status: 400 }));
    });

    expect((await send()).status).toBe(400);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('does not emit a logged 501 once the only app listener was a once listener', async () => {
    const onceListener = vi.fn();
    const { send } = await startThrowingServer(
      ctx => throwLoggedNotImplemented(ctx, Object.assign(new Error('not implemented'), { status: 501 })),
      app => app.once('error', onceListener),
    );

    expect((await send()).status).toBe(501);
    expect((await send()).status).toBe(501);
    expect(onceListener).toHaveBeenCalledTimes(1);
  });

  it('notifies an errorMonitor-only app of a 400 and a logged 501', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const monitor = vi.fn();
    const { send } = await startServer(app => app.on(errorMonitor, monitor));

    expect((await send()).status).toBe(400);
    expect(monitor).toHaveBeenCalledTimes(1);
    expect(monitor.mock.calls[0]![0]).toMatchObject({ status: 400 });
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = null;

    const notImplemented = Object.assign(new Error('not implemented'), { status: 501 });
    const throwing = await startThrowingServer(
      ctx => throwLoggedNotImplemented(ctx, notImplemented),
      app => app.on(errorMonitor, monitor),
    );
    expect((await throwing.send()).status).toBe(501);
    expect(monitor).toHaveBeenCalledTimes(2);
    expect(monitor.mock.calls[1]![0]).toBe(notImplemented);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('delivers the 400 to an onerror override on a Koa subclass', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const subclassOnError = vi.fn();
    class CustomKoa extends Koa {
      onerror(err: Error) {
        subclassOnError(err);
      }
    }
    const mastra = new Mastra({});
    const app = new CustomKoa();
    const adapter = new MastraServer({ app, mastra });
    (adapter as any).registerErrorMiddleware();
    app.use(() => {
      throw Object.assign(new Error('bad request'), { status: 400 });
    });
    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    expect((await fetch(`http://localhost:${port}/`)).status).toBe(400);
    expect(subclassOnError).toHaveBeenCalledTimes(1);
    expect(subclassOnError.mock.calls[0]![0]).toMatchObject({ status: 400 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps the 501 for a logged non-Error object', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { send } = await startThrowingServer(ctx =>
      throwLoggedNotImplemented(ctx, { status: 501, message: 'not implemented' }),
    );

    expect((await send()).status).toBe(501);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
