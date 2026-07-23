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
  createBodyLimitTestSuite,
} from '@internal/server-adapter-test-utils';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
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
describe('Fastify Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Fastify Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      // Create Fastify app
      const app = Fastify();

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

    executeHttpRequest: async (app: FastifyInstance, httpRequest: HttpRequest): Promise<HttpResponse> => {
      // Start server on random port
      const address = await app.listen({ port: 0 });

      try {
        // Build URL with query params
        let url = `${address}${httpRequest.path}`;
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
          contentType.includes('audio/') ||
          contentType.includes('application/octet-stream') ||
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
        await app.close();
      }
    },
  });

  describe('Stream Data Redaction', () => {
    let context: AdapterTestContext;
    let app: FastifyInstance | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        app.server.closeAllConnections?.();
        await app.close();
        app = null;
      }
    });

    it('should redact sensitive data from stream chunks by default', async () => {
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/stream`, {
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

    it('should pass SSE comment chunks through without data wrapping', async () => {
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/sse-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain(': heartbeat\n\n');
      expect(text).toContain('data: {"type":"text-delta","payload":{"text":"hello"}}\n\n');
      expect(text).not.toContain('data: ": heartbeat');
    });

    it('should write SSE connected comment when sseFlushOnConnect is true', async () => {
      app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/sse-flush',
        responseType: 'stream',
        streamFormat: 'sse',
        sseFlushOnConnect: true,
        handler: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-delta', payload: { text: 'hello' } });
              controller.close();
            },
          }),
      };

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/sse-flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      const connectedIndex = text.indexOf(': connected\n\n');
      const dataIndex = text.indexOf('data: ');
      expect(connectedIndex).toBeGreaterThanOrEqual(0);
      expect(dataIndex).toBeGreaterThanOrEqual(0);
      expect(connectedIndex).toBeLessThan(dataIndex);
    });

    it('should not write SSE connected comment when sseFlushOnConnect is not set', async () => {
      app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/sse-no-flush',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-delta', payload: { text: 'hello' } });
              controller.close();
            },
          }),
      };

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/sse-no-flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain(': connected');
      expect(text).toContain('data: ');
    });

    it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/stream`, {
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
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/stream-v1`, {
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
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/stream`, {
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

  // Repro for https://github.com/mastra-ai/mastra/issues/17821 — a chunk that
  // JSON.stringify can't handle (e.g. a BigInt step output) used to throw inside
  // the stream loop and silently close the HTTP stream.
  describe('Stream Chunk Serialization', () => {
    let context: AdapterTestContext;
    let app: FastifyInstance | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        app.server.closeAllConnections?.();
        await app.close();
        app = null;
      }
    });

    it('serializes BigInt chunks and skips unserializable chunks without killing the stream', async () => {
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/unserializable-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const chunks = await consumeSSEStream(response.body);
      expectSerializedStreamChunks(chunks);
    });
  });

  describe('Abort Signal', () => {
    let context: AdapterTestContext;
    let app: FastifyInstance | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should not have aborted signal when route handler executes', async () => {
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      // Make a POST request with a JSON body (this triggers body parsing which can cause the issue)
      const response = await fetch(`${address}/test/abort-signal`, {
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
      app = Fastify();

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

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/abort-signal-exists`, {
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
    suiteName: 'Fastify Multipart FormData',

    setupAdapter: async (context, options) => {
      const app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        bodyLimitOptions: options?.bodyLimitOptions,
      });

      await adapter.init();

      return { app, adapter };
    },

    startServer: async (app: FastifyInstance) => {
      const address = await app.listen({ port: 0 });

      return {
        baseUrl: address,
        cleanup: async () => {
          await app.close();
        },
      };
    },

    registerRoute: async (adapter, app, route, options) => {
      await adapter.registerRoute(app, route, options || { prefix: '' });
    },

    getContextMiddleware: adapter => adapter.createContextMiddleware(),

    applyMiddleware: (app, middleware) => {
      app.addHook('preHandler', middleware);
    },
  });

  describe('Plugin Headers on Stream Responses', () => {
    let context: AdapterTestContext;
    let app: FastifyInstance | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should preserve headers set by plugins/hooks on stream responses', async () => {
      app = Fastify();

      // Simulate what a CORS plugin does: set headers in an onRequest hook
      // This tests that headers set before the route handler are preserved
      // when using reply.hijack() for streaming
      app.addHook('onRequest', async (_request, reply) => {
        reply.header('access-control-allow-origin', 'https://example.com');
        reply.header('access-control-allow-credentials', 'true');
        reply.header('x-custom-header', 'custom-value');
      });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      // Create a test route that returns a stream
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/stream',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Headers set by the hook should be preserved on stream responses
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('x-custom-header')).toBe('custom-value');

      // Consume the stream to avoid hanging
      await consumeSSEStream(response.body);
    });

    it('should preserve headers set by plugins/hooks on non-stream (JSON) responses', async () => {
      app = Fastify();

      // Simulate what a CORS plugin does: set headers in an onRequest hook
      app.addHook('onRequest', async (_request, reply) => {
        reply.header('access-control-allow-origin', 'https://example.com');
        reply.header('access-control-allow-credentials', 'true');
        reply.header('x-custom-header', 'custom-value');
      });

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      // Create a test route that returns JSON (not a stream)
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/json',
        responseType: 'json',
        handler: async () => ({ message: 'hello' }),
      };

      app.addHook('preHandler', adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      // Start server
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/test/json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Headers should be present on JSON responses (this already works without the fix)
      expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('x-custom-header')).toBe('custom-value');

      await response.json();
    });
  });

  describe('Multipart File Handling (Busboy)', () => {
    let context: AdapterTestContext;
    let app: FastifyInstance | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (app) {
        await app.close();
        app = null;
      }
    });

    it('should expose uploaded file as buffer', async () => {
      app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload',
        responseType: 'json',
        handler: async (params: any) => {
          return params;
        },
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const form = new FormData();
      form.append('file', new Blob(['hello world']), 'test.txt');

      const response = await fetch(`${address}/test/upload`, {
        method: 'POST',
        body: form as any,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.file).toBeDefined();

      // reconstruct buffer from JSON
      const reconstructed = Buffer.from(data.file.data);

      expect(reconstructed.toString()).toBe('hello world');
    });

    it('should return error when file exceeds size limit (no hang)', async () => {
      app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        bodyLimitOptions: { maxSize: 1024 },
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/upload-limit',
        responseType: 'json',
        handler: async (params: any) => params,
      };

      adapter.registerContextMiddleware();
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      const address = await app.listen({ port: 0 });

      const bigBuffer = new Uint8Array(1024 * 10);

      const form = new FormData();
      form.append('file', new Blob([bigBuffer]), 'big.txt');

      const response = await fetch(`${address}/test/upload-limit`, {
        method: 'POST',
        body: form as any,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Custom route prefix validation', () => {
    it('should throw when a custom route path starts with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/mastra/custom', {
          method: 'GET',
          handler: async c => c.json({ message: 'should not work' }),
        }),
      ];

      const mastra = new Mastra({});
      const app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await expect(adapter.init()).rejects.toThrow(/must not start with "\/mastra"/);
      await app.close();
    });

    it('should allow custom routes at paths not starting with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/custom/hello', {
          method: 'GET',
          handler: async c => c.json({ message: 'Hello from custom route!' }),
        }),
      ];

      const mastra = new Mastra({});
      const app = Fastify();

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await adapter.init();
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/custom/hello`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Hello from custom route!' });
      await app.close();
    });
  });

  describe('Custom route stream disconnect handling', () => {
    let app: FastifyInstance | null = null;

    afterEach(async () => {
      if (app) {
        app.server.closeAllConnections?.();
        await app.close();
        app = null;
      }
    });

    it('cancels a custom route stream when the client cancels the response body', async () => {
      const cancel = vi.fn();
      const signalAbort = vi.fn();
      const customRoutes = [
        registerApiRoute('/custom/stream', {
          method: 'GET',
          handler: async c => {
            c.req.raw.signal.addEventListener('abort', signalAbort);
            return new Response(
              new ReadableStream({
                async pull(controller) {
                  controller.enqueue(new TextEncoder().encode('chunk\n'));
                  await sleep(5);
                },
                cancel,
              }),
            );
          },
        }),
      ];

      app = Fastify();
      const adapter = new MastraServer({
        app,
        mastra: new Mastra({}),
        customApiRoutes: customRoutes,
      });

      await adapter.init();
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/custom/stream`);
      const reader = response.body!.getReader();
      await reader.read();
      await reader.cancel();

      await waitFor(() => cancel.mock.calls.length > 0);
      await waitFor(() => signalAbort.mock.calls.length > 0);
    });

    it('does not cancel a custom POST stream when the completed request body closes normally', async () => {
      const cancel = vi.fn();
      const signalAbort = vi.fn();
      const customRoutes = [
        registerApiRoute('/custom/post-stream', {
          method: 'POST',
          handler: async c => {
            c.req.raw.signal.addEventListener('abort', signalAbort);
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode('one\n'));
                  setTimeout(() => {
                    controller.enqueue(new TextEncoder().encode('two\n'));
                    controller.enqueue(new TextEncoder().encode('three\n'));
                    controller.close();
                  }, 10);
                },
                cancel,
              }),
            );
          },
        }),
      ];

      app = Fastify();
      const adapter = new MastraServer({
        app,
        mastra: new Mastra({}),
        customApiRoutes: customRoutes,
      });

      await adapter.init();
      const address = await app.listen({ port: 0 });

      const response = await fetch(`${address}/custom/post-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      });

      await expect(response.text()).resolves.toBe('one\ntwo\nthree\n');
      await sleep(10);
      expect(cancel).not.toHaveBeenCalled();
      expect(signalAbort).not.toHaveBeenCalled();
    });
  });

  createBodyLimitTestSuite({
    suiteName: 'Body Size Limit',

    createApp: () => Fastify({ logger: false }),

    setupAdapter: (app, mastra, bodyLimitOptions) => {
      const adapter = new MastraServer({ app, mastra, bodyLimitOptions });
      adapter.registerContextMiddleware();
      return { adapter, app };
    },

    registerRoute: (adapter, app, route) => adapter.registerRoute(app, route, { prefix: '' }),

    executeRequest: async (app, method, url, options = {}) => {
      const parsedUrl = new URL(url);
      const injectOptions: any = {
        method,
        url: parsedUrl.pathname + parsedUrl.search,
        headers: options.headers || {},
      };

      if (options.body) {
        injectOptions.payload = options.body;
        injectOptions.headers['content-type'] = 'application/json';
      }

      const response = await app.inject(injectOptions);
      return { status: response.statusCode };
    },

    cleanupApp: app => app.close(),
  });
});
