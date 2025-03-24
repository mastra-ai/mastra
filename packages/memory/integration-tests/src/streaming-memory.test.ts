import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { useChat } from '@ai-sdk/react';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Message } from 'ai';
import { Hono } from 'hono';
import { JSDOM } from 'jsdom';
import { describe, expect, it, afterEach } from 'vitest';
import { z } from 'zod';

// Set up JSDOM environment for React testing
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});
// @ts-ignore - JSDOM types don't match exactly but this works for testing
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.fetch = global.fetch || fetch;

describe('Memory Streaming Tests', () => {
  // Add delay after each test
  afterEach(() => {
    return new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should stream after tool call with memory only', async () => {
    const memory = new Memory({
      options: {
        workingMemory: {
          enabled: true,
          use: 'tool-call',
        },
      },
    });

    // Create test tools
    const weatherTool = createTool({
      id: 'get_weather',
      description: 'Get the weather for a given location',
      inputSchema: z.object({
        postalCode: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ context: { postalCode } }) => {
        return `The weather in ${postalCode} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
      },
    });

    // Create agent with memory and tools
    const agent = new Agent({
      name: 'test',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
      model: openai('gpt-4o'),
      memory,
      tools: { get_weather: weatherTool },
    });

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    // First weather check
    const stream1 = await agent.stream('what is the weather in LA?', {
      threadId,
      resourceId,
    });

    // Collect first stream
    const chunks1: string[] = [];
    for await (const chunk of stream1.textStream) {
      chunks1.push(chunk);
    }
    const response1 = chunks1.join('');

    expect(chunks1.length).toBeGreaterThan(0);
    expect(response1).toContain('LA');
    expect(response1).toContain('weather');
    expect(response1).toContain('70 degrees');

    // Second weather check
    const stream2 = await agent.stream('what is the weather in Seattle?', {
      threadId,
      resourceId,
    });

    // Collect second stream
    const chunks2: string[] = [];
    for await (const chunk of stream2.textStream) {
      chunks2.push(chunk);
    }
    const response2 = chunks2.join('');

    expect(chunks2.length).toBeGreaterThan(0);
    expect(response2).toContain('Seattle');
    expect(response2).toContain('weather');
    expect(response2).toContain('70 degrees');
  });

  describe('should stream via useChat after tool call', () => {
    let server: ReturnType<typeof serve>;
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    afterEach(() => {
      if (server) {
        server.close();
      }
    });

    it.only('should stream via useChat after tool call', async () => {
      // Create memory instance
      const memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            use: 'tool-call',
          },
        },
      });

      // Create test tools
      const weatherTool = createTool({
        id: 'get_weather',
        description: 'Get the weather for a given location',
        inputSchema: z.object({
          postalCode: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ context: { postalCode } }) => {
          console.log(`tool call!`);
          return `The weather in ${postalCode} is sunny. It is currently 70 degrees and feels like 65 degrees.`;
        },
      });

      // Create agent with memory and tools
      const agent = new Agent({
        name: 'test',
        instructions:
          'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
        model: openai('gpt-4o'),
        memory,
        tools: { get_weather: weatherTool },
      });

      // Set up Hono server
      const app = new Hono();

      app.use('*', async (c, next) => {
        console.log('Incoming request:', c.req.method, c.req.url);
        await next();
      });

      // Add chat endpoint
      app.post('/api/chat/', async c => {
        console.log('Chat endpoint hit');
        const body = await c.req.json();
        const { messages, threadId, resourceId } = body;

        // Get last message
        const lastMessage = messages[messages.length - 1];
        console.log('Processing message:', lastMessage);

        // Stream response
        const stream = await agent.stream(lastMessage.content, {
          threadId,
          resourceId,
        });

        console.log('Agent stream created');

        return new Response(stream.toDataStream(), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      });

      // Start server
      server = serve({
        fetch: app.fetch,
        port: 0,
      });

      // Get the actual port
      const port = (server.address() as { port: number }).port;
      console.log('Server started on port:', port);

      const { result } = renderHook(() => {
        const chat = useChat({
          api: `http://localhost:${port}/api/chat/`,
          experimental_prepareRequestBody({ messages, id }: { messages: Message[]; id: string }) {
            console.log('useChat preparing request:', { messages, id });
            return {
              messages,
              threadId,
              resourceId,
            };
          },
          // onResponse(response) {
          // console.log('useChat received response:', response);
          // },
          onFinish(message) {
            console.log('useChat finished:', message);
          },
          onError(error) {
            console.error('useChat error:', error);
          },
        });
        // console.log('useChat hook result:', chat);
        return chat;
      });

      console.log('Initial messages:', result.current.messages);

      // Trigger weather tool
      await act(async () => {
        console.log('Sending weather request');
        await result.current.append({
          id: '1',
          role: 'user',
          content: 'what is the weather in LA?',
        });
        console.log('Message appended');
      });

      console.log('After append messages:', result.current.messages);

      // Wait for first response
      await new Promise(resolve => setTimeout(resolve, 1000));
      await waitFor(
        () => {
          expect(result.current.messages).toHaveLength(2);
          expect(result.current.messages[1].content).toContain('LA');
          expect(result.current.messages[1].content).toContain('70 degrees');
        },
        { timeout: 5000 },
      );

      // Send another message
      await act(async () => {
        await result.current.append({
          id: '2',
          role: 'user',
          content: 'what is the weather in Seattle?',
        });
      });

      // Wait for second response
      await new Promise(resolve => setTimeout(resolve, 1000));
      await waitFor(
        () => {
          expect(result.current.messages).toHaveLength(4);
          expect(result.current.messages[3].content).toContain('Seattle');
          expect(result.current.messages[3].content).toContain('70 degrees');
        },
        { timeout: 5000 },
      );

      console.log(`final messages`, result.current.messages);
    });
  });
});
