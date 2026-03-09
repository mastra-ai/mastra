import type { Server } from 'node:http';
import type {
  AdapterTestContext,
  AdapterSetupOptions,
  HttpRequest,
  HttpResponse,
} from '@internal/server-adapter-test-utils';
import {
  createRouteAdapterTestSuite,
  createDefaultTestContext,
  createStreamWithSensitiveData,
  consumeSSEStream,
  createMultipartTestSuite,
} from '@internal/server-adapter-test-utils';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MastraServer } from '../index';

// Wrapper describe block so the factory can call describe() inside
describe('Koa Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Koa Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      // Create Koa app
      const app = new Koa();
      app.use(bodyParser());

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        prefix: options?.prefix,
      });

      await adapter.init();

      return { app, adapter };
    },

    executeHttpRequest: async (app: Koa, httpRequest: HttpRequest): Promise<HttpResponse> => {
      // Start server on random port
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      try {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Failed to get server address');
        }
        const port = address.port;
        const baseUrl = `http://localhost:${port}`;

        // Build URL with query params
        let url = `${baseUrl}${httpRequest.path}`;
        if (httpRequest.query) {
          const queryParams = new URLSearchParams();
          Object.entries(httpRequest.query).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach(v => queryParams.append(key, String(v)));
            } else {
              queryParams.append(key, String(value));
            }
          });
          const queryString = queryParams.toString();
          if (queryString) {
            url += `?${queryString}`;
          }
        }

        // Build fetch options
        const fetchOptions: RequestInit = {
          method: httpRequest.method,
          headers: {
            'Content-Type': 'application/json',
            ...(httpRequest.headers || {}),
          },
        };

        // Add body for POST/PUT/PATCH/DELETE
        if (httpRequest.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpRequest.method)) {
          fetchOptions.body = JSON.stringify(httpRequest.body);
        }

        // Execute request
        const response = await fetch(url, fetchOptions);

        // Extract headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Check if stream response
        const contentType = response.headers.get('content-type') || '';
        const transferEncoding = response.headers.get('transfer-encoding') || '';
        const isStream =
          contentType.includes('text/plain') ||
          contentType.includes('text/event-stream') ||
          transferEncoding === 'chunked';

        if (isStream && response.body) {
          // Return stream response
          return {
            status: response.status,
            type: 'stream',
            stream: response.body,
            headers,
          };
        } else {
          // JSON response - check content type to decide how to parse
          let data: unknown;
          const responseContentType = response.headers.get('content-type') || '';

          if (responseContentType.includes('application/json')) {
            try {
              data = await response.json();
            } catch {
              // If JSON parsing fails, return empty object
              data = {};
            }
          } else {
            // Not JSON content type, read as text
            data = await response.text();
          }

          return {
            status: response.status,
            type: 'json',
            data,
            headers,
          };
        }
      } finally {
        // Always close server
        await new Promise<void>((resolve, reject) => {
          server.close(err => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    },
  });

  describe('Stream Data Redaction', () => {
    let context: AdapterTestContext;
    let server: Server | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

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

    it('should redact sensitive data from stream chunks by default', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        // Default: streamOptions.redact = true
      });

      // Create a test route that returns a stream with sensitive data
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const chunks = await consumeSSEStream(response.body);

      // Verify chunks exist
      expect(chunks.length).toBeGreaterThan(0);

      // Check that sensitive data is NOT present in any chunk
      const allChunksStr = JSON.stringify(chunks);
      expect(allChunksStr).not.toContain('SECRET_SYSTEM_PROMPT');
      expect(allChunksStr).not.toContain('secret_tool');

      // Verify step-start chunk has empty request
      const stepStart = chunks.find(c => c.type === 'step-start');
      expect(stepStart).toBeDefined();
      expect(stepStart.payload.request).toEqual({});

      // Verify step-finish chunk has no request in metadata
      const stepFinish = chunks.find(c => c.type === 'step-finish');
      expect(stepFinish).toBeDefined();
      expect(stepFinish.payload.metadata.request).toBeUndefined();
      expect(stepFinish.payload.output.steps[0].request).toBeUndefined();

      // Verify finish chunk has no request in metadata
      const finish = chunks.find(c => c.type === 'finish');
      expect(finish).toBeDefined();
      expect(finish.payload.metadata.request).toBeUndefined();
    });

    it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        streamOptions: { redact: false },
      });

      // Create a test route that returns a stream with sensitive data
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const chunks = await consumeSSEStream(response.body);

      // Verify chunks exist
      expect(chunks.length).toBeGreaterThan(0);

      // Check that sensitive data IS present (not redacted)
      const allChunksStr = JSON.stringify(chunks);
      expect(allChunksStr).toContain('SECRET_SYSTEM_PROMPT');
      expect(allChunksStr).toContain('secret_tool');

      // Verify step-start chunk has full request
      const stepStart = chunks.find(c => c.type === 'step-start');
      expect(stepStart).toBeDefined();
      expect(stepStart.payload.request.body).toContain('SECRET_SYSTEM_PROMPT');
    });

    it('should redact v1 format stream chunks', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        // Default: streamOptions.redact = true
      });

      // Create a test route that returns a v1 format stream
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream-v1',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v1'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/stream-v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const chunks = await consumeSSEStream(response.body);

      // Check that sensitive data is NOT present
      const allChunksStr = JSON.stringify(chunks);
      expect(allChunksStr).not.toContain('SECRET_SYSTEM_PROMPT');
      expect(allChunksStr).not.toContain('secret_tool');

      // Verify step-start chunk has empty request (v1 format)
      const stepStart = chunks.find(c => c.type === 'step-start');
      expect(stepStart).toBeDefined();
      expect(stepStart.request).toEqual({});

      // Verify step-finish chunk has no request (v1 format)
      const stepFinish = chunks.find(c => c.type === 'step-finish');
      expect(stepFinish).toBeDefined();
      expect(stepFinish.request).toBeUndefined();
    });

    it('should pass through non-sensitive chunk types unchanged', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const chunks = await consumeSSEStream(response.body);

      // Verify text-delta chunk is unchanged
      const textDelta = chunks.find(c => c.type === 'text-delta');
      expect(textDelta).toBeDefined();
      expect(textDelta.textDelta).toBe('Hello');
    });
  });

  describe('Abort Signal', () => {
    let context: AdapterTestContext;
    let server: Server | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

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

    it('should not have aborted signal when route handler executes', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      // Track the abort signal state when the handler executes
      let abortSignalAborted: boolean | undefined;

      // Create a test route that checks the abort signal state
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/abort-signal',
        responseType: 'json',
        handler: async (params: any) => {
          // Capture the abort signal state when handler runs
          abortSignalAborted = params.abortSignal?.aborted;
          return { signalAborted: abortSignalAborted };
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      // Make a POST request with a JSON body (this triggers body parsing which can cause the issue)
      const response = await fetch(`http://localhost:${port}/test/abort-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // The abort signal should NOT be aborted during normal request handling
      expect(result.signalAborted).toBe(false);
      expect(abortSignalAborted).toBe(false);
    });

    it('should provide abort signal to route handlers', async () => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      let receivedAbortSignal: AbortSignal | undefined;

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/abort-signal-exists',
        responseType: 'json',
        handler: async (params: any) => {
          receivedAbortSignal = params.abortSignal;
          return { hasSignal: !!params.abortSignal };
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/test/abort-signal-exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const result = await response.json();

      // Route handler should receive an abort signal
      expect(result.hasSignal).toBe(true);
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  // Multipart FormData tests
  createMultipartTestSuite({
    suiteName: 'Koa Multipart FormData',

    setupAdapter: async (context, options) => {
      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        bodyLimitOptions: options?.bodyLimitOptions,
      });

      await adapter.init();

      return { app, adapter };
    },

    startServer: async (app: Koa) => {
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      return {
        baseUrl: `http://localhost:${port}`,
        cleanup: async () => {
          await new Promise<void>((resolve, reject) => {
            server.close(err => {
              if (err) reject(err);
              else resolve();
            });
          });
        },
      };
    },

    registerRoute: async (adapter, app, route, options) => {
      await adapter.registerRoute(app, route, options || { prefix: '' });
    },

    getContextMiddleware: adapter => adapter.createContextMiddleware(),

    applyMiddleware: (app, middleware) => {
      app.use(middleware);
    },
  });

  describe('Custom API Routes (registerApiRoute)', () => {
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

    it('should register and respond to custom API routes added via registerApiRoute', async () => {
      // This reproduces the bug reported by users: custom API routes registered via
      // registerApiRoute() are silently ignored by non-Hono server adapters.
      // They show up in the OpenAPI spec but return 404.
      const customRoutes = [
        registerApiRoute('/hello', {
          method: 'GET',
          handler: async c => {
            return c.json({ message: 'Hello from custom route!' });
          },
        }),
      ];

      const mastra = new Mastra({});

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      // Start server
      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      // Request the custom route
      const response = await fetch(`http://localhost:${port}/hello`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Hello from custom route!' });
    });

    it('should register custom API routes with POST method', async () => {
      const customRoutes = [
        registerApiRoute('/echo', {
          method: 'POST',
          handler: async c => {
            const body = await c.req.json();
            return c.json({ echo: body });
          },
        }),
      ];

      const mastra = new Mastra({});

      const app = new Koa();
      app.use(bodyParser());

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ echo: { test: 'data' } });
    });
  });
});
