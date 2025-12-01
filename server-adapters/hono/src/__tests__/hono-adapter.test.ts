import type { AdapterTestContext, HttpRequest, HttpResponse } from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite, createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach } from 'vitest';
import { HonoServerAdapter } from '../index';

/**
 * Creates a ReadableStream that emits chunks with sensitive data
 * This simulates what an agent.stream() call would return with request metadata
 */
function createStreamWithSensitiveData(format: 'v1' | 'v2' = 'v2') {
  const sensitiveRequest = {
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'system', content: 'SECRET_SYSTEM_PROMPT' }],
      tools: [{ name: 'secret_tool', description: 'Internal tool' }],
    }),
  };

  const chunks =
    format === 'v2'
      ? [
          {
            type: 'step-start',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              request: sensitiveRequest,
              warnings: [],
            },
          },
          { type: 'text-delta', textDelta: 'Hello' },
          {
            type: 'step-finish',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              metadata: { request: sensitiveRequest },
              output: {
                text: 'Hello',
                steps: [{ request: sensitiveRequest, response: { id: 'resp-1' } }],
              },
            },
          },
          {
            type: 'finish',
            runId: 'run-123',
            from: 'AGENT',
            payload: {
              messageId: 'msg-123',
              metadata: { request: sensitiveRequest },
              output: {
                text: 'Hello',
                steps: [{ request: sensitiveRequest }],
              },
            },
          },
        ]
      : [
          {
            type: 'step-start',
            messageId: 'msg-123',
            request: sensitiveRequest,
            warnings: [],
          },
          { type: 'text-delta', textDelta: 'Hello' },
          {
            type: 'step-finish',
            finishReason: 'stop',
            request: sensitiveRequest,
          },
          {
            type: 'finish',
            finishReason: 'stop',
            request: sensitiveRequest,
          },
        ];

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/**
 * Helper to consume a stream and parse SSE chunks
 */
async function consumeSSEStream(stream: ReadableStream<Uint8Array> | null): Promise<any[]> {
  if (!stream) return [];
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    // Parse SSE format: "data: {...}\n\n"
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          chunks.push(JSON.parse(line.slice(6)));
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }

  return chunks;
}

// Wrapper describe block so the factory can call describe() inside
describe('Hono Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Hono Adapter Integration Tests',
    routes: SERVER_ROUTES,

    setupAdapter: (context: AdapterTestContext) => {
      const app = new Hono();

      // Create Hono adapter
      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        playground: context.playground,
        isDev: context.isDev,
      });

      // Register context middleware
      app.use('*', adapter.createContextMiddleware());

      // Register all routes
      SERVER_ROUTES.forEach(route => {
        adapter.registerRoute(app, route, { prefix: '' });
      });

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

      // Execute request through Hono
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

      // Check if response is defined
      if (!response) {
        return {
          status: 500,
          type: 'json',
          data: { error: 'No response returned from handler' },
          headers: {},
        };
      }

      // Parse response
      const contentType = response.headers?.get('content-type') || '';
      const isStream = contentType.includes('text/plain') || response.headers?.get('transfer-encoding') === 'chunked';

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
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          data = await response.text();
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

  describe('Stream Data Redaction', () => {
    let context: AdapterTestContext;

    beforeEach(async () => {
      context = await createDefaultTestContext();
    });

    it('should redact sensitive data from stream chunks by default', async () => {
      const app = new Hono();

      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
        // Default: streamOptions.redact = true
      });

      // Create a test route that returns a stream with sensitive data
      const testRoute: ServerRoute = {
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

    it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
      const app = new Hono();

      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
        streamOptions: { redact: false },
      });

      // Create a test route that returns a stream with sensitive data
      const testRoute: ServerRoute = {
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

      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
        // Default: streamOptions.redact = true
      });

      // Create a test route that returns a v1 format stream
      const testRoute: ServerRoute = {
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

      const adapter = new HonoServerAdapter({
        mastra: context.mastra,
      });

      const testRoute: ServerRoute = {
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
});
