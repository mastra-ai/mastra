import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import { HTTPException } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Koa from 'koa';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MastraServer } from '../index';

describe('Koa 501 handler error logging', () => {
  let server: Server | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close(err => (err ? reject(err) : resolve())));
      server = null;
    }
  });

  const requestFailingRoute = async (
    error: Error,
    configureApp?: (app: Koa) => void,
    configureInsideBoundary?: (app: Koa) => void,
  ) => {
    const mastra = new Mastra({});
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    vi.spyOn(mastra, 'getLogger').mockReturnValue(logger as any);

    const app = new Koa();
    configureApp?.(app);
    const adapter = new MastraServer({ app, mastra });
    // Registers the final error boundary without loading every built-in route.
    (adapter as any).registerErrorMiddleware();
    configureInsideBoundary?.(app);

    const failingRoute: ServerRoute<any, any, any> = {
      method: 'GET',
      path: '/test/failing',
      responseType: 'json',
      handler: async () => {
        throw error;
      },
    };
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, failingRoute, { prefix: '' });

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://localhost:${port}/test/failing`);
    return { response, logger };
  };

  it("does not pass a logged 501 to Koa's default error listener", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, logger } = await requestFailingRoute(new HTTPException(501, { message: 'Not supported' }));

    expect(response.status).toBe(501);
    expect(logger.warn).toHaveBeenCalledWith('Error calling handler', expect.anything());
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('still notifies custom error listeners about 501s', async () => {
    const listener = vi.fn();

    const { response } = await requestFailingRoute(new HTTPException(501, { message: 'Not supported' }), app =>
      app.on('error', listener),
    );

    expect(response.status).toBe(501);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 501 }), expect.anything());
  });

  it("passes a different 501 thrown by later middleware to Koa's default error listener", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response } = await requestFailingRoute(
      new HTTPException(501, { message: 'Not supported' }),
      undefined,
      app =>
        app.use(async (_ctx, next) => {
          try {
            await next();
          } catch {
            throw new HTTPException(501, { message: 'Replaced by middleware' });
          }
        }),
    );

    expect(response.status).toBe(501);
    expect(consoleError).toHaveBeenCalled();
  });

  it("still passes server errors to Koa's default error listener", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, logger } = await requestFailingRoute(new Error('boom'));

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith('Error calling handler', expect.anything());
    expect(consoleError).toHaveBeenCalled();
  });
});
