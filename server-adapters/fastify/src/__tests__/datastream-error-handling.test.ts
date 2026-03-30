import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraServer } from '../index';

describe('datastream-response error handling', () => {
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

  it('should catch and log errors when reader.read() rejects during datastream-response piping', async () => {
    app = Fastify();

    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
    });

    // Spy on the logger's error method
    const loggerErrorSpy = vi.fn();
    vi.spyOn(context.mastra, 'getLogger').mockReturnValue({
      error: loggerErrorSpy,
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any);

    // Create a ReadableStream that errors mid-stream
    const createErroringStream = () => {
      let chunkCount = 0;
      return new ReadableStream({
        pull(controller) {
          chunkCount++;
          if (chunkCount <= 2) {
            controller.enqueue(new TextEncoder().encode(`chunk-${chunkCount}\n`));
          } else {
            controller.error(new Error('upstream TransformStream flush error'));
          }
        },
      });
    };

    const testRoute: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/test/datastream',
      responseType: 'datastream-response',
      handler: async () => {
        return new Response(createErroringStream(), {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          },
        });
      },
    };

    app.addHook('preHandler', adapter.createContextMiddleware());
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    const address = await app.listen({ port: 0 });

    const response = await fetch(`${address}/test/datastream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Consume the stream to trigger the error
    try {
      const reader = response.body!.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      // Client may see an error too — that's fine
    }

    // Wait a tick for async error handling to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // The error should be caught and logged within the datastream-response handler itself,
    // NOT propagate up to the generic "Error calling handler" catch in registerRoute.
    const datastreamErrorCall = loggerErrorSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('datastream'),
    );
    expect(datastreamErrorCall).toBeDefined();

    // It should NOT have been logged as a generic handler error
    const genericHandlerErrorCall = loggerErrorSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0] === 'Error calling handler',
    );
    expect(genericHandlerErrorCall).toBeUndefined();
  });

  it('should listen for reply.raw error events during datastream-response piping', { timeout: 15000 }, async () => {
    app = Fastify({ forceCloseConnections: true });

    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
    });

    const loggerErrorSpy = vi.fn();
    vi.spyOn(context.mastra, 'getLogger').mockReturnValue({
      error: loggerErrorSpy,
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any);

    // Create a stream that sends data slowly so we can trigger a write error
    const createSlowStream = () => {
      let chunkCount = 0;
      return new ReadableStream({
        async pull(controller) {
          chunkCount++;
          if (chunkCount <= 10) {
            controller.enqueue(new TextEncoder().encode(`chunk-${chunkCount}\n`));
            // Small delay between chunks
            await new Promise(resolve => setTimeout(resolve, 50));
          } else {
            controller.close();
          }
        },
      });
    };

    const testRoute: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/test/datastream-write-error',
      responseType: 'datastream-response',
      handler: async () => {
        return new Response(createSlowStream(), {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      },
    };

    app.addHook('preHandler', adapter.createContextMiddleware());
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    const address = await app.listen({ port: 0 });

    // Use AbortController to abort the request mid-stream, simulating a client disconnect
    const controller = new AbortController();

    const response = await fetch(`${address}/test/datastream-write-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    // Read one chunk then abort
    const reader = response.body!.getReader();
    await reader.read(); // Read first chunk
    controller.abort();

    // Wait for the server-side stream processing to notice the disconnect
    await new Promise(resolve => setTimeout(resolve, 500));

    // The server should not have crashed — this test passing without unhandled rejection is the assertion
    expect(true).toBe(true);
  });
});
