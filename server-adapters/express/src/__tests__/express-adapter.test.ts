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
  createStreamWithUnserializableChunk,
  expectSerializedStreamChunks,
  consumeSSEStream,
  createMultipartTestSuite,
  createBodyLimitTestSuite,
} from '@internal/server-adapter-test-utils';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';
import express from 'express';
import type { Application } from 'express';
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
describe('Express Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Express Adapter Integration Tests',

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      // Create Express app
      const app = express();
      app.use(express.json());

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

    executeHttpRequest: async (app: Application, httpRequest: HttpRequest): Promise<HttpResponse> => {
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
        await new Promise<void>(resolve => {
          server.close(() => resolve());
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
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('should redact sensitive data from stream chunks by default', async () => {
      const app = express();
      app.use(express.json());

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
      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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

    it('should pass SSE comment chunks through without data wrapping', async () => {
      const app = express();
      app.use(express.json());

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

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/sse-comment`, {
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
      const app = express();
      app.use(express.json());

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

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/sse-flush`, {
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
      const app = express();
      app.use(express.json());

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

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/sse-no-flush`, {
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
      const app = express();
      app.use(express.json());

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
      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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
      const app = express();
      app.use(express.json());

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
      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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
      const app = express();
      app.use(express.json());

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
      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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

  // Repro for https://github.com/mastra-ai/mastra/issues/17821 — a chunk that
  // JSON.stringify can't handle (e.g. a BigInt step output) used to throw inside
  // the stream loop and silently close the HTTP stream.
  describe('Stream Chunk Serialization', () => {
    let context: AdapterTestContext;
    let server: Server | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('serializes BigInt chunks and skips unserializable chunks without killing the stream', async () => {
      const app = express();
      app.use(express.json());

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

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      const response = await fetch(`http://localhost:${address.port}/test/unserializable-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const chunks = await consumeSSEStream(response.body);
      expectSerializedStreamChunks(chunks);
    });
  });

  describe('SSE Headers', () => {
    let context: AdapterTestContext;
    let server: Server | null = null;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('should set Content-Type to text/event-stream for SSE streams', async () => {
      const app = express();
      app.use(express.json());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/sse-headers',
        responseType: 'stream',
        streamFormat: 'sse',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/sse-headers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // SSE streams MUST use text/event-stream Content-Type
      // This signals to proxies, CDNs, and clients that the response should not be buffered
      const contentType = response.headers.get('content-type');
      expect(contentType).toBe('text/event-stream');

      // SSE streams should include Cache-Control: no-cache to prevent proxy buffering
      const cacheControl = response.headers.get('cache-control');
      expect(cacheControl).toBe('no-cache');

      // SSE streams should include Connection: keep-alive
      const connection = response.headers.get('connection');
      expect(connection).toBe('keep-alive');

      // SSE streams should include X-Accel-Buffering: no for nginx reverse proxies
      const xAccelBuffering = response.headers.get('x-accel-buffering');
      expect(xAccelBuffering).toBe('no');

      // Consume the stream to avoid hanging
      await consumeSSEStream(response.body);
    });

    it('should keep Content-Type as text/plain for non-SSE streams', async () => {
      const app = express();
      app.use(express.json());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      // Use 'stream' format (not 'sse') — this should keep text/plain
      const testRoute: ServerRoute<any, any, any> = {
        method: 'POST',
        path: '/test/plain-stream',
        responseType: 'stream',
        streamFormat: 'stream',
        handler: async () => createStreamWithSensitiveData('v2'),
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/plain-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      // Non-SSE streams should keep text/plain
      const contentType = response.headers.get('content-type');
      expect(contentType).toBe('text/plain');

      // Consume the stream to avoid hanging
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
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
        await new Promise<void>(resolve => {
          server!.close(() => resolve());
        });
        server = null;
      }
    });

    it('should not have aborted signal when route handler executes', async () => {
      const app = express();
      app.use(express.json());

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
      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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
      const app = express();
      app.use(express.json());

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

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

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

    it('aborts registered route signals when the response closes early', async () => {
      const app = express();
      app.use(express.json());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
      });

      const signalAbort = vi.fn();
      const testRoute: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/stream-close',
        responseType: 'stream',
        handler: async (params: any) => {
          params.abortSignal?.addEventListener('abort', signalAbort);
          return {
            fullStream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'text-delta', textDelta: 'one' });
                await sleep(10);
                controller.enqueue({ type: 'text-delta', textDelta: 'two' });
                controller.close();
              },
            }),
          };
        },
      };

      app.use(adapter.createContextMiddleware());
      await adapter.registerRoute(app, testRoute, { prefix: '' });

      server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      const response = await fetch(`http://localhost:${port}/test/stream-close`);
      const reader = response.body!.getReader();
      await reader.read();
      await reader.cancel();
      await waitFor(() => signalAbort.mock.calls.length > 0);

      expect(signalAbort).toHaveBeenCalledTimes(1);
    });
  });

  // Multipart FormData tests
  createMultipartTestSuite({
    suiteName: 'Express Multipart FormData',

    setupAdapter: async (context, options) => {
      const app = express();
      app.use(express.json());

      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        bodyLimitOptions: options?.bodyLimitOptions,
      });

      await adapter.init();

      return { app, adapter };
    },

    startServer: async (app: Application) => {
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
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
      const customRoutes = [
        registerApiRoute('/hello', {
          method: 'GET',
          handler: async c => {
            return c.json({ message: 'Hello from custom route!' });
          },
        }),
      ];

      const mastra = new Mastra({});
      const app = express();
      app.use(express.json());

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
      const app = express();
      app.use(express.json());

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

  describe('Custom route stream disconnect handling', () => {
    let server: Server | null = null;

    afterEach(async () => {
      if (server) {
        await new Promise<void>(resolve => server!.close(() => resolve()));
        server = null;
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

      const app = express();
      app.use(express.json());
      const adapter = new MastraServer({ app, mastra: new Mastra({}), customApiRoutes: customRoutes });
      await adapter.init();

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/custom/stream`);
      const reader = response.body!.getReader();
      await reader.read();
      await reader.cancel();

      await waitFor(() => cancel.mock.calls.length > 0);
      await waitFor(() => signalAbort.mock.calls.length > 0);
    });

    it('does not cancel a custom POST stream when the request completes normally', async () => {
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
                    controller.close();
                  }, 10);
                },
                cancel,
              }),
            );
          },
        }),
      ];

      const app = express();
      app.use(express.json());
      const adapter = new MastraServer({ app, mastra: new Mastra({}), customApiRoutes: customRoutes });
      await adapter.init();

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/custom/post-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      });

      await expect(response.text()).resolves.toBe('one\ntwo\n');
      await sleep(10);
      expect(cancel).not.toHaveBeenCalled();
      expect(signalAbort).not.toHaveBeenCalled();
    });
  });

  describe('Custom route prefix validation', () => {
    let server: Server | null = null;

    afterEach(async () => {
      if (server) {
        await new Promise<void>(resolve => server!.close(() => resolve()));
        server = null;
      }
    });

    it('should throw when a custom route path starts with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/mastra/custom', {
          method: 'GET',
          handler: async c => c.json({ message: 'should not work' }),
        }),
      ];

      const app = express();
      app.use(express.json());
      const mastra = new Mastra({});

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await expect(adapter.init()).rejects.toThrow(/must not start with "\/mastra"/);
    });

    it('should allow custom routes at paths not starting with the server prefix', async () => {
      const customRoutes = [
        registerApiRoute('/custom/hello', {
          method: 'GET',
          handler: async c => c.json({ message: 'Hello from custom route!' }),
        }),
      ];

      const app = express();
      app.use(express.json());
      const mastra = new Mastra({});

      const adapter = new MastraServer({
        app,
        mastra,
        customApiRoutes: customRoutes,
        prefix: '/mastra',
      });

      await adapter.init();

      server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const response = await fetch(`http://localhost:${port}/custom/hello`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Hello from custom route!' });
    });
  });

  createBodyLimitTestSuite({
    suiteName: 'Body Size Limit',

    createApp: () => {
      const app = express();
      app.use(express.json());
      return app;
    },

    setupAdapter: (app, mastra, bodyLimitOptions) => {
      const adapter = new MastraServer({ app, mastra, bodyLimitOptions });
      app.use(adapter.createContextMiddleware());
      return { adapter, app };
    },

    registerRoute: (adapter, app, route) => adapter.registerRoute(app, route, { prefix: '' }),

    executeRequest: async (app, method, url, options = {}) => {
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      try {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Failed to get server address');
        }
        const parsedUrl = new URL(url);
        const response = await fetch(`http://localhost:${address.port}${parsedUrl.pathname}${parsedUrl.search}`, {
          method,
          headers: options.headers,
          ...(options.body ? { body: options.body } : {}),
        });
        return { status: response.status };
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    },
  });
});
