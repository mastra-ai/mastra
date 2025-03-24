import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { useChat } from '@ai-sdk/react';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Message } from 'ai';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
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
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    it.only('should stream via useChat after tool call', async () => {
      let error: Error | null = null;
      const { result } = renderHook(() => {
        const chat = useChat({
          api: `http://localhost:4111/api/agents/test/stream`,
          experimental_prepareRequestBody({ messages }: { messages: Message[]; id: string }) {
            // console.log('useChat preparing request:', { messages, id, threadId, resourceId });
            return {
              messages,
              threadId,
              resourceId,
            };
          },
          onFinish(_message) {
            // console.log('useChat finished:', _message);
          },
          onError(e) {
            error = e;
            console.error('useChat error:', error);
          },
        });
        return chat;
      });

      // console.log('Initial messages:', result.current.messages);

      // Trigger weather tool
      await act(async () => {
        // console.log('Sending weather request');
        await result.current.append({
          role: 'user',
          content: 'what is the weather in Los Angeles?',
        });
        // console.log('Message appended');
      });

      // console.log('After append messages:', result.current.messages);

      expect(error).toBeNull();
      await waitFor(
        () => {
          expect(result.current.messages).toHaveLength(2);
          expect(result.current.messages[1].content).toContain('Los Angeles');
          expect(result.current.messages[1].content).toContain('70 degrees');
        },
        { timeout: 5000 },
      );

      expect(error).toBeNull();

      // Send another message
      await act(async () => {
        await result.current.append({
          role: 'user',
          content: 'what is the weather in Seattle?',
        });
      });

      expect(error).toBeNull();
      await waitFor(
        () => {
          expect(result.current.messages).toHaveLength(4);
          expect(result.current.messages[3].content).toContain('Seattle');
          expect(result.current.messages[3].content).toContain('70 degrees');
        },
        { timeout: 5000 },
      );

      expect(error).toBeNull();
      // console.log(`final messages`, result.current.messages);
    });
  });
});
