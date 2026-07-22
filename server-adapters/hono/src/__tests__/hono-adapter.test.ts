import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
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
  createStreamWithUnserializableChunk,
  expectSerializedStreamChunks,
  consumeSSEStream,
  createMultipartTestSuite,
} from '@internal/server-adapter-test-utils';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { MASTRA_IS_STUDIO_KEY } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraServer } from '../index';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(assertion: () => boolean, timeout = 500): Promise<void> {
  const start = Date.now();
  while (!assertion()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for assertion');
    }
    await sleep(1);
  }
}

// Wrapper describe block so the factory can call describe() inside
describe('Hono Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Hono Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      const app = new Hono();

      // Create Hono adapter
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        prefix: options?.prefix,
      });

      await adapter.init();

      return { adapter, app };
    },

    executeHttpRequest: async (app: Hono, request: HttpRequest): Promise<HttpResponse> => {
      // Build full URL with query params
      let url = `http://localhost${request.path}`;
      if (request.query) {
        const queryParams = new URLSearchParams();
        Object.entries(request.query).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, value);
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Build Web Request
      const req = new Request(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers || {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      // Execute request through Hono - app.request() always returns Promise<Response>
      let response: Response;
      try {
        response = await app.request(req);
      } catch (error) {
        // If the request throws an error, return a 500 response
        return {
          status: 500,
          type: 'json',
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
          headers: {},
        };
      }

      // Parse response
      const contentType = response.headers?.get('content-type') || '';
      const isStream =
        contentType.includes('text/plain') ||
        contentType.includes('text/event-stream') ||
        contentType.includes('audio/') ||
        contentType.includes('application/octet-stream') ||
        response.headers?.get('transfer-encoding') === 'chunked';

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers?.forEach((value, key) => {
        headers[key] = value;
      });

      if (isStream) {
        return {
          status: response.status,
          type: 'stream',
          stream: response.body,
          headers,
        };
      } else {
        // Read the body exactly once; parsing JSON from text avoids consuming
        // the body twice when the payload is not valid JSON.
        const rawText = await response.text();
        let data: unknown;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }

        return {
          status: response.status,
          type: 'json',
          data,
          headers,
        };
      }
    },
  });

  describe('SSE stream handshake', () => {
    let context: AdapterTestContext;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    it('writes an initial SSE comment when sseFlushOnConnect is true', async () => {
      const app = new Hono();
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/waiting-stream',
        responseType: 'stream',
        streamFormat: 'sse',
        sseFlushOnConnect: true,
        handler: async () => new ReadableStream(),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(new Request('http://localhost/test/waiting-stream'));
      const reader = response.body!.getReader();

      try {
        const firstChunk = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out waiting for SSE handshake')), 100),
          ),
        ]);

        expect(new TextDecoder().decode(firstChunk.value)).toBe(': connected\n\n');
      } finally {
        await reader.cancel();
      }
    });

    it('does not write an initial SSE comment when sseFlushOnConnect is not set', async () => {
      const app = new Hono();
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/waiting-stream-no-flush',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-delta', textDelta: 'hello' });
              controller.close();
            },
          }),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(new Request('http://localhost/test/waiting-stream-no-flush'));
      const reader = response.body!.getReader();

      try {
        const firstChunk = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out waiting for first chunk')), 100),
          ),
        ]);

        const text = new TextDecoder().decode(firstChunk.value);
        expect(text).not.toContain(': connected');
        expect(text).toContain('data: ');
      } finally {
        await reader.cancel();
      }
    });
  });

  describe('Stream Data Redaction', () => {
    let context: AdapterTestContext;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    it('should redact sensitive data from stream chunks by default', async () => {
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

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

    it('should pass SSE comment chunks through without data wrapping', async () => {
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/sse-comment',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(': heartbeat\n\n');
              controller.enqueue({ type: 'text-delta', payload: { text: 'hello' } });
              controller.close();
            },
          }),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/sse-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain(': heartbeat\n\n');
      expect(text).toContain('data: {"type":"text-delta","payload":{"text":"hello"}}\n\n');
      expect(text).not.toContain('data: ": heartbeat');
    });

    it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

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
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/stream-v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

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
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      const chunks = await consumeSSEStream(response.body);

      // Verify text-delta chunk is unchanged
      const textDelta = chunks.find(c => c.type === 'text-delta');
      expect(textDelta).toBeDefined();
      expect(textDelta.textDelta).toBe('Hello');
    });
  });

  // Repro for https://github.com/mastra-ai/mastra/issues/17821 — a chunk that
  // JSON.stringify can't handle (e.g. a BigInt step output) used to throw inside
  // the stream loop and silently close the HTTP stream, so Studio never received
  // the remaining chunks and workflow nodes stayed visually "running" forever.
  describe('Stream Chunk Serialization', () => {
    let context: AdapterTestContext;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    it('serializes BigInt chunks and skips unserializable chunks without killing the stream', async () => {
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/unserializable-stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithUnserializableChunk(),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/unserializable-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(200);
      const chunks = await consumeSSEStream(response.body);
      expectSerializedStreamChunks(chunks);
    });
  });

  describe('Abort Signal', () => {
    let context: AdapterTestContext;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    it('should not have aborted signal when route handler executes', async () => {
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Make a POST request with a JSON body (this triggers body parsing which can cause the issue)
      const response = await app.request(
        new Request('http://localhost/test/abort-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        }),
      );

      expect(response.status).toBe(200);
      const result = await response.json();

      // The abort signal should NOT be aborted during normal request handling
      expect(result.signalAborted).toBe(false);
      expect(abortSignalAborted).toBe(false);
    });

    it('should provide abort signal to route handlers', async () => {
      const app = new Hono();

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

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/abort-signal-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

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
    suiteName: 'Hono Multipart FormData',

    setupAdapter: async (context, options) => {
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        bodyLimitOptions: options?.bodyLimitOptions,
      });

      await adapter.init();

      return { app, adapter };
    },

    startServer: async (app: Hono) => {
      const server = serve({
        fetch: app.fetch,
        port: 0, // Random available port
      }) as Server;

      // Wait for server to be listening
      await new Promise<void>(resolve => {
        server.once('listening', () => resolve());
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      return {
        baseUrl: `http://localhost:${address.port}`,
        cleanup: async () => {
          await new Promise<void>(resolve => {
            server.close(() => resolve());
          });
        },
      };
    },

    registerRoute: async (adapter, app, route, options) => {
      await adapter.registerRoute(app, route, options || { prefix: '' });
    },

    getContextMiddleware: adapter => adapter.createContextMiddleware(),

    applyMiddleware: (app, middleware) => {
      app.use('*', middleware);
    },
  });

  describe('OpenAPI Spec', () => {
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

    it('should serve the OpenAPI spec at /api/openapi.json', async () => {
      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        openapiPath: '/openapi.json',
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const prefixedResponse = await fetch(`http://localhost:${port}/api/openapi.json`);
      expect(prefixedResponse.status).toBe(200);
      const prefixedSpec = await prefixedResponse.json();
      expect(prefixedSpec.openapi).toBe('3.1.0');
      expect(prefixedSpec.servers).toEqual([{ url: '/api' }]);
    });

    it('should set per-path servers override on custom routes in the spec', async () => {
      const customRoutes = [
        registerApiRoute('/health', {
          method: 'GET',
          openapi: {
            summary: 'Health check',
            description: 'Returns health status',
            tags: ['Health'],
            responses: {
              200: { description: 'OK' },
            },
          },
          handler: async c => {
            return c.json({ status: 'ok' });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        openapiPath: '/openapi.json',
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/api/openapi.json`);
      const spec = await response.json();

      // Built-in routes should NOT have per-path servers (they use top-level servers)
      const builtinPaths = Object.keys(spec.paths).filter(p => p !== '/health');
      for (const p of builtinPaths) {
        expect(spec.paths[p].servers).toBeUndefined();
      }

      expect(spec.paths['/health']).toBeDefined();
      expect(spec.paths['/health'].servers).toEqual([{ url: '/' }]);
    });

    it('should not add servers override to custom routes when no prefix is used', async () => {
      const customRoutes = [
        registerApiRoute('/health', {
          method: 'GET',
          openapi: {
            summary: 'Health check',
            description: 'Returns health status',
            responses: { 200: { description: 'OK' } },
          },
          handler: async c => {
            return c.json({ status: 'ok' });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        prefix: '',
        openapiPath: '/openapi.json',
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/openapi.json`);
      const spec = await response.json();

      expect(spec.paths['/health']).toBeDefined();
      expect(spec.paths['/health'].servers).toBeUndefined();
      expect(spec.servers).toBeUndefined();
    });

    it('should enforce root-level servers override on custom routes', async () => {
      const customRoutes = [
        registerApiRoute('/external', {
          method: 'GET',
          openapi: {
            summary: 'External endpoint',
            description: 'Route with custom servers',
            servers: [{ url: 'https://external.example.com' }],
            responses: { 200: { description: 'OK' } },
          },
          handler: async c => {
            return c.json({ ok: true });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        openapiPath: '/openapi.json',
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/api/openapi.json`);
      const spec = await response.json();

      expect(spec.paths['/external']).toBeDefined();
      expect(spec.paths['/external'].servers).toEqual([{ url: '/' }]);
    });
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
      const customRoutes = [
        registerApiRoute('/hello', {
          method: 'GET',
          handler: async c => {
            return c.json({ message: 'Hello from custom route!' });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

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
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
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

    it('should propagate request abort signals to custom API route handlers', async () => {
      const signalAbort = vi.fn();
      let routeSignal: AbortSignal | undefined;
      const customRoutes = [
        registerApiRoute('/signal', {
          method: 'GET',
          handler: async c => {
            routeSignal = c.req.raw.signal;
            routeSignal.addEventListener('abort', signalAbort);
            return c.json({ aborted: routeSignal.aborted });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
      });

      await adapter.init();

      const controller = new AbortController();
      const response = await app.request(
        new Request('http://localhost/signal', {
          signal: controller.signal,
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ aborted: false });
      expect(routeSignal?.aborted).toBe(false);

      controller.abort();
      await waitFor(() => signalAbort.mock.calls.length > 0);
      expect(routeSignal?.aborted).toBe(true);
    });

    it('should throw when a custom route path starts with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/mastra/custom', {
          method: 'GET',
          handler: async c => c.json({ message: 'should not work' }),
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await expect(adapter.init()).rejects.toThrow(/must not start with "\/mastra"/);
    });

    it('should allow framework-internal routes under the server prefix', async () => {
      const customRoutes = [
        {
          path: '/mastra/agents/bot/channels/slack/webhook',
          method: 'POST' as const,
          requiresAuth: false,
          _mastraInternal: true,
          handler: async (c: any) => c.json({ ok: true }),
        },
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await expect(adapter.init()).resolves.not.toThrow();
    });

    it('should allow custom routes at paths not starting with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/custom/hello', {
          method: 'GET',
          handler: async c => c.json({ message: 'Hello from custom route!' }),
        }),
      ];

      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/custom/hello`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Hello from custom route!' });
    });
  });

  describe('Reserved context key injection prevention', () => {
    it('should strip mastra__resourceId from client-provided requestContext in body', async () => {
      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/context',
        responseType: 'json',
        handler: async ({ requestContext }) => {
          return {
            resourceId: requestContext?.get('mastra__resourceId') ?? null,
            isStudio: requestContext?.get(MASTRA_IS_STUDIO_KEY) ?? null,
            customKey: requestContext?.get('myKey') ?? null,
          };
        },
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestContext: {
              mastra__resourceId: 'injected-victim-id',
              [MASTRA_IS_STUDIO_KEY]: true,
              myKey: 'safe-value',
            },
          }),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.resourceId).toBeNull();
      expect(data.isStudio).toBeNull();
      expect(data.customKey).toBe('safe-value');
    });

    it('should strip mastra__threadId from client-provided requestContext in body', async () => {
      const mastra = new Mastra({});
      const app = new Hono();

      const adapter = new MastraServer({ app, mastra });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/context',
        responseType: 'json',
        handler: async ({ requestContext }) => {
          return {
            threadId: requestContext?.get('mastra__threadId') ?? null,
            customKey: requestContext?.get('myKey') ?? null,
          };
        },
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestContext: {
              mastra__resourceId: 'injected-victim-id',
              mastra__threadId: 'injected-thread-id',
              myKey: 'safe-value',
            },
          }),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.threadId).toBeNull();
      expect(data.customKey).toBe('safe-value');
    });

    it('should strip reserved keys from client-provided requestContext in GET query params', async () => {
      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/context',
        responseType: 'json',
        handler: async ({ requestContext }) => {
          return {
            resourceId: requestContext?.get('mastra__resourceId') ?? null,
            threadId: requestContext?.get('mastra__threadId') ?? null,
            isStudio: requestContext?.get(MASTRA_IS_STUDIO_KEY) ?? null,
            customKey: requestContext?.get('myKey') ?? null,
          };
        },
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const queryContext = JSON.stringify({
        mastra__resourceId: 'injected-victim-id',
        mastra__threadId: 'injected-thread-id',
        [MASTRA_IS_STUDIO_KEY]: true,
        myKey: 'safe-value',
      });

      const response = await app.request(
        new Request(`http://localhost/test/context?requestContext=${encodeURIComponent(queryContext)}`, {
          method: 'GET',
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.resourceId).toBeNull();
      expect(data.threadId).toBeNull();
      expect(data.isStudio).toBeNull();
      expect(data.customKey).toBe('safe-value');
    });

    it('should set reserved Studio context from x-mastra-client-type header', async () => {
      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/context',
        responseType: 'json',
        handler: async ({ requestContext }) => {
          return {
            isStudio: requestContext?.get(MASTRA_IS_STUDIO_KEY) ?? null,
          };
        },
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/context', {
          method: 'GET',
          headers: { 'x-mastra-client-type': 'studio' },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isStudio).toBe(true);
    });

    it('should not set reserved Studio context when x-mastra-client-type is not studio', async () => {
      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({ app, mastra });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/context',
        responseType: 'json',
        handler: async ({ requestContext }) => {
          return {
            isStudio: requestContext?.get(MASTRA_IS_STUDIO_KEY) ?? null,
          };
        },
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      for (const headers of [{ 'x-mastra-client-type': 'playground' }, {}]) {
        const response = await app.request(
          new Request('http://localhost/test/context', {
            method: 'GET',
            headers,
          }),
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.isStudio).toBeNull();
      }
    });
  });

  describe('Body Size Limit', () => {
    // Regression coverage for the `shouldApplyBodyLimit` check in registerRoute: DELETE
    // requests previously bypassed bodyLimitOptions.maxSize entirely, even though
    // getParams() reads and JSON-parses the body for DELETE requests too. A DELETE request
    // could therefore carry a body far larger than maxSize with no rejection.
    const maxSize = 100; // bytes
    const oversizedPayload = JSON.stringify({ padding: 'x'.repeat(maxSize * 4) });

    function buildAdapter() {
      const mastra = new Mastra({});
      const app = new Hono();
      const adapter = new MastraServer({
        app,
        mastra,
        bodyLimitOptions: {
          maxSize,
          onError: () => ({ error: 'Request body too large' }),
        },
      });
      return { app, adapter };
    }

    it('rejects an oversized POST body with 413', async () => {
      const { app, adapter } = buildAdapter();

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/body-limit',
        responseType: 'json',
        handler: async ({ body }) => ({ receivedBody: body }),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/body-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: oversizedPayload,
        }),
      );

      expect(response.status).toBe(413);
    });

    it('rejects an oversized DELETE body with 413 (regression: DELETE used to bypass the limit)', async () => {
      const { app, adapter } = buildAdapter();

      const testRoute: ServerRoute<any, any, any> = {
        method: 'DELETE',
        path: '/test/body-limit',
        responseType: 'json',
        handler: async ({ body }) => ({ receivedBody: body }),
      };

      app.use('*', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const response = await app.request(
        new Request('http://localhost/test/body-limit', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: oversizedPayload,
        }),
      );

      // Same maxSize, same payload size, only the method differs from the POST case above.
      // DELETE used to return 200 here because it was excluded from `shouldApplyBodyLimit`,
      // even though getParams() still buffers and JSON-parses the whole body for DELETE.
      expect(response.status).toBe(413);
    });
  });
});
