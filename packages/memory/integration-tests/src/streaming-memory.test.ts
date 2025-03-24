import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

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
      instructions: 'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code.',
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
});

