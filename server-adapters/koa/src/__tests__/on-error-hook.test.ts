import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { describe, it, expect, afterEach } from 'vitest';
import { MastraServer } from '../index';

describe('Koa onError hook integration tests', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      server = null;
    }
  });

  describe('Custom Error Handler (server.onError)', () => {
    it('should call custom onError handler when route handler throws', async () => {
      let onErrorCalled = false;
      let capturedError: Error | undefined;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            onErrorCalled = true;
            capturedError = err;
            return c.json(
              {
                customError: true,
                message: err.message,
                timestamp: '2024-01-01T00:00:00Z',
              },
              500,
            );
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/error',
        responseType: 'json',
        handler: async () => {
          throw new Error('Test error for onError hook');
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/error`);

      expect(response.status).toBe(500);

      const result = await response.json();

      expect(onErrorCalled).toBe(true);
      expect(capturedError?.message).toBe('Test error for onError hook');
      expect(result).toEqual({
        customError: true,
        message: 'Test error for onError hook',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should allow sending errors to external services like Sentry', async () => {
      const sentryErrors: Error[] = [];

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            sentryErrors.push(err);
            return c.json({ error: 'Internal server error', sentryTracked: true }, 500);
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/sentry',
        responseType: 'json',
        handler: async () => {
          throw new Error('Error to track in Sentry');
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/sentry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.sentryTracked).toBe(true);

      expect(sentryErrors).toHaveLength(1);
      expect(sentryErrors[0]?.message).toBe('Error to track in Sentry');
    });

    it('should pass request details to onError handler via context shim', async () => {
      let capturedPath: string | undefined;
      let capturedMethod: string | undefined;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            capturedPath = (c as any).req.path;
            capturedMethod = (c as any).req.method;
            return c.json(
              {
                error: err.message,
                path: (c as any).req.path,
                method: (c as any).req.method,
              },
              500,
            );
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'PUT',
        path: '/test/context-access',
        responseType: 'json',
        handler: async () => {
          throw new Error('Context access test');
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/context-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(500);

      const result = await response.json();

      expect(capturedPath).toBe('/test/context-access');
      expect(capturedMethod).toBe('PUT');
      expect(result.path).toBe('/test/context-access');
      expect(result.method).toBe('PUT');
    });

    it('should use custom status code from onError handler', async () => {
      const mastra = new Mastra({
        server: {
          onError: (_err, c) => {
            return c.json({ error: 'Not found by custom handler' }, 404);
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/custom-status',
        responseType: 'json',
        handler: async () => {
          throw new Error('Not found');
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/custom-status`);

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Not found by custom handler');
    });
  });

  describe('Error Propagation to Koa Middleware', () => {
    it('should propagate errors to upstream Koa error middleware when no onError is set', async () => {
      let middlewareCaughtError = false;
      let caughtMessage: string | undefined;

      const mastra = new Mastra({});

      const app = new Koa();
      app.use(bodyParser());

      // Register error-handling middleware BEFORE Mastra (upstream in Koa's chain)
      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (err: any) {
          middlewareCaughtError = true;
          caughtMessage = err.message;
          ctx.status = err.status || 500;
          ctx.body = { middleware: true, error: err.message };
        }
      });

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/propagate',
        responseType: 'json',
        handler: async () => {
          throw new Error('Should reach middleware');
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/propagate`);

      expect(response.status).toBe(500);
      const result = await response.json();

      expect(middlewareCaughtError).toBe(true);
      expect(caughtMessage).toBe('Should reach middleware');
      expect(result.middleware).toBe(true);
    });

    it('should preserve HTTPException status codes when propagating errors', async () => {
      const mastra = new Mastra({});

      const app = new Koa();
      app.use(bodyParser());

      // Error middleware
      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (err: any) {
          ctx.status = err.status || 500;
          ctx.body = { error: err.message, status: err.status };
        }
      });

      const adapter = new MastraServer({
        app,
        mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/http-status',
        responseType: 'json',
        handler: async () => {
          const err = new Error('Forbidden resource') as Error & { status: number };
          err.status = 403;
          throw err;
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/http-status`);

      expect(response.status).toBe(403);
      const result = await response.json();
      expect(result.error).toBe('Forbidden resource');
      expect(result.status).toBe(403);
    });
  });

  describe('Error Handling via init()', () => {
    it('should handle errors through init() with onError configured', async () => {
      let onErrorCalled = false;

      const mastra = new Mastra({
        server: {
          onError: (err, c) => {
            onErrorCalled = true;
            return c.json({ handled: true, message: err.message }, 500);
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      // Use init() which registers error middleware automatically
      await adapter.init();

      // Register a test route after init
      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/init-error',
        responseType: 'json',
        handler: async () => {
          throw new Error('Error via init');
        },
      };

      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/init-error`);

      expect(response.status).toBe(500);
      const result = await response.json();

      expect(onErrorCalled).toBe(true);
      expect(result).toEqual({ handled: true, message: 'Error via init' });
    });

    it('should fall back to default error response when onError itself throws', async () => {
      let onErrorCallCount = 0;

      const mastra = new Mastra({
        server: {
          onError: () => {
            onErrorCallCount++;
            throw new Error('onError handler crashed');
          },
        },
      });

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
      });

      await adapter.init();

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/onerror-throws',
        responseType: 'json',
        handler: async () => {
          throw new Error('Original error');
        },
      };

      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/onerror-throws`);

      expect(response.status).toBe(500);
      const result = await response.json();
      // Should fall back to default error response
      expect(result).toEqual({ error: 'Original error' });
      // onError should only be called once (guard prevents double invocation)
      expect(onErrorCallCount).toBe(1);
    });
  });
});
