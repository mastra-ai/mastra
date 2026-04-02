import type { Server, ServerResponse } from 'node:http';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraServer } from '../index';

describe('datastream-response error handling', () => {
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

  it('should catch and log errors when reader.read() rejects during datastream-response piping', async () => {
    const app = express();
    app.use(express.json());

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

    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://localhost:${port}/test/datastream`, {
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

  it('should log errors when res emits an error during datastream-response piping', async () => {
    const app = express();
    app.use(express.json());

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

    // Capture the raw response so we can destroy it mid-stream
    let capturedRes: ServerResponse | null = null;

    // Create a stream that sends data slowly so we have time to destroy the response
    const createSlowStream = () => {
      let chunkCount = 0;
      return new ReadableStream({
        async pull(controller) {
          chunkCount++;
          if (chunkCount <= 20) {
            controller.enqueue(new TextEncoder().encode(`chunk-${chunkCount}\n`));
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

    // Middleware to capture the response object before the route handler
    app.use((req, res, next) => {
      capturedRes = res;
      next();
    });
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, testRoute, { prefix: '' });

    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // Start the request (don't await the full response)
    const fetchPromise = fetch(`http://localhost:${port}/test/datastream-write-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});

    // Wait for the response to start streaming
    await new Promise(resolve => setTimeout(resolve, 150));

    // Emit an error on the response to simulate a socket-level write failure
    capturedRes!.emit('error', new Error('simulated connection reset'));

    // Wait for error handling to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    await fetchPromise;

    // Verify the error was logged through the response error handler
    const writePathErrorCall = loggerErrorSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0] === 'Error writing datastream response',
    );
    expect(writePathErrorCall).toBeDefined();
  });
});
