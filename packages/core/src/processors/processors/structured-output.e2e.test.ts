import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';

import { createTool } from '../../tools';
import type { Processor } from '../index';

describe('Structured Output with Tool Execution', () => {
  it('should generate structured output when tools are involved', async () => {
    // Test processor to track streamParts state
    const streamPartsLog: { type: string; streamPartsLength: number }[] = [];
    class StateTrackingProcessor implements Processor {
      id = 'state-tracking-processor';
      name = 'State Tracking Processor';
      async processOutputStream({ part, streamParts }: any) {
        streamPartsLog.push({ type: part.type, streamPartsLength: streamParts.length });
        // console.log(`Processor saw ${part.type}, streamParts.length: ${streamParts.length}`);
        return part;
      }
    }

    // Define the structured output schema
    const responseSchema = z.object({
      toolUsed: z.string(),
      result: z.string(),
      confidence: z.number(),
    });

    // Mock tool that returns a result
    const mockTool = {
      description: 'A calculator tool',
      parameters: {
        type: 'object' as const,
        properties: {
          a: { type: 'number' as const },
          b: { type: 'number' as const },
        },
        required: ['a', 'b'] as const,
      },
      execute: vi.fn(async (input: { a: number; b: number }, _context: any) => {
        return { sum: input.a + input.b };
      }),
    };

    // Create mock model that calls a tool and returns structured output
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        // Check if this is the first call or after tool execution
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // First LLM call - request tool execution
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-123',
                toolName: 'calculator',
                input: JSON.stringify({ a: 5, b: 3 }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        } else {
          // Second LLM call - after tool execution, return structured output
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: '{"toolUsed":"calculator","result":"8","confidence":0.95}' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent with structured output and tools',
      model: mockModel as any,
      tools: {
        calculator: mockTool,
      },
      outputProcessors: [new StateTrackingProcessor()],
    });

    // Stream the response
    const stream = await agent.stream('Calculate 5 + 3 and return structured output', {
      maxSteps: 5,
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'), // Use real model for structured output processor
      },
    });

    // Don't consume fullStream first - get the object while consuming
    const fullStreamChunks: any[] = [];

    // Consume full stream and wait for object in parallel
    const [chunks, finalObject] = await Promise.all([
      (async () => {
        const collected: any[] = [];
        for await (const chunk of stream.fullStream) {
          collected.push(chunk);
        }
        return collected;
      })(),
      stream.object,
    ]);

    fullStreamChunks.push(...chunks);

    // ISSUE: Before the fix, no structured output would be generated when tools are involved
    // The structured output processor would lose state between LLM calls or not trigger at all

    // Verify the final object matches the schema
    expect(finalObject).toBeDefined();
    expect(finalObject.toolUsed).toBe('calculator');
    expect(finalObject.result).toBe('8');
    expect(typeof finalObject.confidence).toBe('number');

    // Verify the tool was actually executed
    expect(fullStreamChunks.find(c => c.type === 'tool-result')).toBeDefined();
  });

  it('should handle structured output with multiple tool calls', async () => {
    const responseSchema = z.object({
      activities: z.array(z.string()),
      toolsCalled: z.array(z.string()),
      location: z.string(),
    });

    const weatherTool = createTool({
      id: 'weather-tool',
      description: 'Get weather for a location',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async (inputData, _context) => {
        const { location } = inputData;
        return {
          temperature: 70,
          feelsLike: 65,
          humidity: 50,
          windSpeed: 10,
          windGust: 15,
          conditions: 'sunny',
          location,
        };
      },
    });

    const planActivities = createTool({
      id: 'plan-activities',
      description: 'Plan activities based on the weather',
      inputSchema: z.object({
        temperature: z.string(),
      }),
      execute: async () => {
        return { activities: 'Plan activities based on the weather' };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions:
        'You are a helpful assistant. Figure out the weather and then using that weather plan some activities. Always use the weather tool first, and then the plan activities tool with the result of the weather tool. Every tool call you make IMMEDIATELY explain the tool results after executing the tool, before moving on to other steps or tool calls',
      model: openai('gpt-4o-mini'),
      tools: {
        weatherTool,
        planActivities,
      },
    });

    const stream = await agent.stream('What is the weather in Toronto?', {
      maxSteps: 10,
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'), // Use real model for structured output processor
      },
    });

    await stream.consumeStream();

    const finalObject = await stream.object;

    // Verify the structured output was generated correctly
    expect(finalObject).toBeDefined();
    expect(finalObject.activities.length).toBeGreaterThanOrEqual(1);
    expect(finalObject.toolsCalled).toHaveLength(2);
    expect(finalObject.location).toBe('Toronto');
  }, 60000);

  it('should NOT use structured output processor when model is not provided', async () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant. Respond with JSON matching the required schema.',
      model: openai('gpt-4o-mini'),
    });

    const result = await agent.generate('What is 2+2?', {
      structuredOutput: {
        schema: responseSchema,
        // Note: no model provided - should use response_format or JSON prompt injection
      },
    });

    // Verify the result has the expected structure
    expect(result.object).toBeDefined();
    expect(result.object.answer).toBeDefined();
    expect(typeof result.object.confidence).toBe('number');
    expect(typeof result.object.answer).toBe('string');
  }, 15000);

  it('should add structuredOutput object to response message metadata', async () => {
    const responseSchema = z.object({
      answer: z.string(),
      confidence: z.number(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant. Answer the question.',
      model: openai('gpt-4o-mini'),
    });

    const stream = await agent.stream('What is 2+2?', {
      structuredOutput: {
        schema: responseSchema,
        model: openai('gpt-4o-mini'),
      },
    });

    // Consume the stream
    const result = await stream.getFullOutput();

    // Verify the structured output is available on the result
    expect(result.object).toBeDefined();
    expect(result.object.answer).toBeDefined();
    expect(typeof result.object.confidence).toBe('number');

    // Check that the structured output is in response message metadata (untyped v2 format)
    const responseMessages = stream.messageList.get.response.db();
    const lastAssistantMessage = [...responseMessages].reverse().find(m => m.role === 'assistant');

    expect(lastAssistantMessage).toBeDefined();
    expect(lastAssistantMessage?.content.metadata).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.structuredOutput).toBeDefined();
    expect(lastAssistantMessage?.content.metadata?.structuredOutput).toEqual(result.object);

    // Note: For typed metadata access, use result.response.uiMessages instead (see below)

    // UIMessages from response have properly typed metadata with structuredOutput
    const uiMessages = (await stream.response).uiMessages;
    const lastAssistantUIMessage = uiMessages!.find(m => m.role === 'assistant');

    expect(lastAssistantUIMessage).toBeDefined();
    expect(lastAssistantUIMessage?.metadata).toBeDefined();
    expect(lastAssistantUIMessage?.metadata?.structuredOutput).toBeDefined();
    expect(lastAssistantUIMessage?.metadata?.structuredOutput).toEqual(result.object);
  }, 15000);
});
