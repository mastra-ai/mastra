import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { registerApiRoute } from '@mastra/core/server';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAssistantText(messages: any[]) {
  return messages
    .filter(message => message.role === 'assistant')
    .map(message => {
      if (typeof message.content === 'string') {
        return message.content;
      }

      if (message.content?.parts) {
        return message.content.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
      }

      return '';
    })
    .join('');
}

describe('Hono custom streaming routes', () => {
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

  it('can continue generation after client disconnect when the route consumes the stream server-side', async () => {
    const totalChunks = 8;
    const chunkDelayMs = 25;
    const threadId = 'custom-route-thread';
    const resourceId = 'custom-route-resource';
    const memory = new MockMemory();

    const model = {
      specificationVersion: 'v2' as const,
      provider: 'mock-provider',
      modelId: 'mock-model',
      supportedUrls: {},
      doGenerate: async () => ({
        rawCall: { rawPrompt: [], rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: totalChunks, totalTokens: 10 + totalChunks },
        content: [{ type: 'text' as const, text: 'full response' }],
        warnings: [],
      }),
      doStream: async () => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'msg-1',
              modelId: 'mock-model',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });

            for (let i = 1; i <= totalChunks; i++) {
              await delay(chunkDelayMs);
              controller.enqueue({
                type: 'text-delta',
                id: 'text-1',
                delta: `chunk-${i} `,
              });
            }

            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: totalChunks, totalTokens: 10 + totalChunks },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    };

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    const customRoutes = [
      registerApiRoute('/stream-continue', {
        method: 'POST',
        handler: async c => {
          const body = await c.req.json();
          const mastra = c.get('mastra');
          const routeAgent = mastra.getAgent('test-agent');

          const stream = await routeAgent.stream(body.prompt, {
            memory: {
              thread: threadId,
              resource: resourceId,
            },
          });

          void stream.consumeStream().catch(() => {});

          return new Response(stream.textStream.pipeThrough(new TextEncoderStream()), {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        },
      }),
    ];

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      logger: false,
    });
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
    const abortController = new AbortController();

    const response = await fetch(`http://localhost:${port}/stream-continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Write a long response' }),
      signal: abortController.signal,
    });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();

    const reader = response.body!.getReader();
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);

    abortController.abort();

    try {
      await reader.read();
    } catch {
      // Expected after the client aborts the request.
    }

    await delay(totalChunks * chunkDelayMs + 300);

    const recalled = await memory.recall({
      threadId,
      resourceId,
      count: 100,
    });
    const assistantText = getAssistantText(recalled.messages);

    expect(assistantText).toContain('chunk-1 ');
    expect(assistantText).toContain(`chunk-${totalChunks}`);
  });
});
