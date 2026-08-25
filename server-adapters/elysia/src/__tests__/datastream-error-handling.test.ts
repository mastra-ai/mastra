/**
 * Datastream Error Handling Tests
 *
 * Tests that errors during datastream-response streaming are handled gracefully
 * without crashing the server or leaking internal errors.
 */

import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { Elysia } from 'elysia';
import { describe, it, expect, beforeEach } from 'vitest';
import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

describe('Datastream Error Handling', () => {
  let context: AdapterTestContext;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  it('should not crash server when stream errors mid-flight', async () => {
    const app = new Elysia();
    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });

    // Register a route that returns a datastream-response with an erroring stream
    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/test/stream-error',
        responseType: 'datastream-response',
        handler: async () => {
          let pullCount = 0;
          const stream = new ReadableStream({
            pull(controller) {
              pullCount += 1;
              if (pullCount === 1) {
                controller.enqueue(new TextEncoder().encode('chunk1\n'));
              } else if (pullCount === 2) {
                controller.enqueue(new TextEncoder().encode('chunk2\n'));
              } else {
                // Simulate a mid-stream error after chunks have flushed
                controller.error(new Error('Stream errored mid-flight'));
              }
            },
          });
          return new Response(stream, {
            headers: { 'Content-Type': 'text/plain' },
          });
        },
      },
      { prefix: '' },
    );

    const { baseUrl, cleanup } = await startElysiaServer(app);

    try {
      // Send request to the erroring stream route
      const response = await fetch(`${baseUrl}/test/stream-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Response should start successfully (200) since the error happens mid-stream
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/plain');

      // Read the stream - should get some chunks before the error
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let receivedText = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedText += decoder.decode(value, { stream: true });
        }
      } catch {
        // Stream error is expected
      }

      // Should have received at least the first chunks
      expect(receivedText).toContain('chunk1');
      expect(receivedText).toContain('chunk2');
    } finally {
      await cleanup();
    }
  });

  it('should continue serving requests after a stream error', async () => {
    const app = new Elysia();
    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });

    // Register a route that returns an erroring stream
    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/test/stream-error',
        responseType: 'datastream-response',
        handler: async () => {
          let pullCount = 0;
          const stream = new ReadableStream({
            pull(controller) {
              pullCount += 1;
              if (pullCount === 1) {
                controller.enqueue(new TextEncoder().encode('data1\n'));
              } else {
                controller.error(new Error('Stream broke'));
              }
            },
          });
          return new Response(stream, {
            headers: { 'Content-Type': 'text/plain' },
          });
        },
      },
      { prefix: '' },
    );

    // Register a normal route
    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/test/normal',
        responseType: 'json',
        handler: async () => ({ ok: true }),
      },
      { prefix: '' },
    );

    const { baseUrl, cleanup } = await startElysiaServer(app);

    try {
      // First, trigger the stream error
      const errorResponse = await fetch(`${baseUrl}/test/stream-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(errorResponse.status).toBe(200);

      // Read the erroring stream to completion
      try {
        await errorResponse.body!.getReader().read();
      } catch {
        // Expected
      }

      // Then verify the server still responds normally
      const normalResponse = await fetch(`${baseUrl}/test/normal`);
      expect(normalResponse.status).toBe(200);
      const data = await normalResponse.json();
      expect(data.ok).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('should handle handler errors as 500 with error message', async () => {
    const app = new Elysia();
    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });

    await adapter.registerRoute(
      app,
      {
        method: 'GET',
        path: '/test/handler-error',
        responseType: 'datastream-response',
        handler: async () => {
          throw new Error('Handler threw an error');
        },
      },
      { prefix: '' },
    );

    const { baseUrl, cleanup } = await startElysiaServer(app);

    try {
      const response = await fetch(`${baseUrl}/test/handler-error`);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    } finally {
      await cleanup();
    }
  });
});
