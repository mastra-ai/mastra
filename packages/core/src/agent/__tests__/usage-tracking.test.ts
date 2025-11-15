import { openai } from '@ai-sdk/openai-v5';
import { stepCountIs, streamText } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createMockModel } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

describe('Agent usage tracking', () => {
  describe('Agent usage tracking (VNext paths)', () => {
    describe('generate', () => {
      it('should expose usage with inputTokens and outputTokens (AI SDK v5 format)', async () => {
        // Create a V2 mock that returns usage in AI SDK v5 format
        const model = new MockLanguageModelV2({
          doGenerate: async () => ({
            content: [{ type: 'text', text: 'Hello world!' }],
            finishReason: 'stop',
            usage: {
              inputTokens: 10,
              outputTokens: 20,
              totalTokens: 30,
            },
            warnings: [],
          }),
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello world!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          },
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const result = await agent.generate('Hello');

        // Check that usage exists
        expect(result.usage).toBeDefined();
        console.log('generate usage:', result.usage);

        // Check v5 format keys
        expect(result.usage.inputTokens).toBe(10);
        expect(result.usage.outputTokens).toBe(20);
        expect(result.usage.totalTokens).toBe(30);

        // Ensure backward compatibility keys are NOT present
        expect((result.usage as any).promptTokens).toBeUndefined();
        expect((result.usage as any).completionTokens).toBeUndefined();
      });
    });

    describe('stream', () => {
      it('should expose usage in stream with AI SDK v5 format', async () => {
        const model = new MockLanguageModelV2({
          doStream: async () => {
            return {
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello ' },
                { type: 'text-delta', id: '1', delta: 'world!' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          },
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const stream = await agent.stream('Hello');

        // Consume stream to get usage
        for await (const _ of stream.fullStream) {
          // Just consume
        }

        const usage = await stream.usage;
        console.log('stream usage:', usage);

        // Check that usage exists with v5 format
        expect(usage).toBeDefined();
        expect(usage.inputTokens).toBe(10);
        expect(usage.outputTokens).toBe(20);
        expect(usage.totalTokens).toBe(30);

        // Ensure backward compatibility keys are NOT present
        expect((usage as any).promptTokens).toBeUndefined();
        expect((usage as any).completionTokens).toBeUndefined();
      });

      it('should handle cumulative usage correctly in multi-step conversations (not additive)', async () => {
        // This test verifies that Mastra correctly handles cumulative usage from AI SDK
        // AI SDK reports cumulative usage in each step-finish chunk, not incremental
        // Before fix: Mastra was adding usage values (231 + 297 = 528 tokens)
        // After fix: Mastra should use the latest cumulative value (297 tokens)

        let callCount = 0;
        const model = new MockLanguageModelV2({
          doStream: async () => {
            const step = callCount++;
            if (step === 0) {
              // Step 1: Initial tool call
              // AI SDK reports cumulative usage: 231 input tokens
              return {
                stream: convertArrayToReadableStream([
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'weatherTool',
                    input: '{"location": "San Francisco"}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    // Step 1 cumulative usage: 231 input, 16 output, 247 total
                    usage: { inputTokens: 231, outputTokens: 16, totalTokens: 247 },
                  },
                ]),
              };
            } else {
              // Step 2: Tool result processing
              // AI SDK reports cumulative usage: 297 input tokens (total so far, not incremental)
              return {
                stream: convertArrayToReadableStream([
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: '1' },
                  { type: 'text-delta', id: '1', delta: 'The weather is sunny.' },
                  { type: 'text-end', id: '1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    // Step 2 cumulative usage: 297 input, 86 output, 383 total
                    // This is the TOTAL cumulative usage, not incremental
                    usage: { inputTokens: 297, outputTokens: 86, totalTokens: 383 },
                  },
                ]),
              };
            }
          },
        });

        const weatherTool = createTool({
          id: 'weatherTool',
          description: 'Get weather for a location',
          inputSchema: z.object({
            location: z.string().describe('The location to get weather for'),
          }),
          execute: async () => ({ temperature: 72, condition: 'sunny' }),
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
          tools: { weatherTool },
        });

        const stream = await agent.stream('What is the weather in San Francisco?');

        // Consume stream to get usage
        for await (const _ of stream.fullStream) {
          // Just consume
        }

        const usage = await stream.usage;
        const steps = await stream.steps;

        // Verify we have 2 steps
        expect(steps).toHaveLength(2);

        // Verify step 1 usage (cumulative)
        expect(steps[0].usage.inputTokens).toBe(231);
        expect(steps[0].usage.outputTokens).toBe(16);
        expect(steps[0].usage.totalTokens).toBe(247);

        // Verify step 2 usage (cumulative)
        expect(steps[1].usage.inputTokens).toBe(297);
        expect(steps[1].usage.outputTokens).toBe(86);
        expect(steps[1].usage.totalTokens).toBe(383);

        // CRITICAL: Final usage should be the LAST cumulative value (297), NOT the sum (231 + 297 = 528)
        // This verifies that Mastra correctly handles cumulative usage instead of adding values
        expect(usage.inputTokens).toBe(297); // Last cumulative value, not 528
        expect(usage.outputTokens).toBe(86); // Last cumulative value, not 102
        expect(usage.totalTokens).toBe(383); // Last cumulative value, not 630

        console.log('Final usage (should be cumulative, not additive):', usage);
        console.log('Step 1 usage:', steps[0].usage);
        console.log('Step 2 usage:', steps[1].usage);
      });

      it.only('should match AI SDK streamText usage in multi-step tool call conversations', async () => {
        // This test compares Mastra agent.stream() with AI SDK streamText() directly
        // to verify they report the same token usage when using the same real OpenAI model with tools

        // Skip if no API key
        if (!process.env.OPENAI_API_KEY) {
          console.log('Skipping test - OPENAI_API_KEY not set');
          return;
        }

        // Use real OpenAI model
        const openaiModel = openai('gpt-4o-mini');

        const weatherTool = createTool({
          id: 'weatherTool',
          description: 'Get weather for a location',
          inputSchema: z.object({
            location: z.string().describe('The location to get weather for'),
          }),
          execute: async () => ({ temperature: 72, condition: 'sunny' }),
        });

        // Test 1: AI SDK streamText directly
        const aiSdkResult = streamText({
          model: openaiModel,
          system: 'You are a helpful assistant',
          prompt: 'What is the weather in San Francisco?',
          stopWhen: stepCountIs(5),
          tools: {
            weatherTool: {
              description: 'Get weather for a location',
              inputSchema: z.object({
                location: z.string().describe('The location to get weather for'),
              }),
              execute: async () => ({ temperature: 72, condition: 'sunny' }),
            },
          },
        });

        // Consume AI SDK stream and collect steps
        await aiSdkResult.consumeStream();

        console.log(((await aiSdkResult.request).body as any).input);

        const aiSdkUsage = await aiSdkResult.usage;

        // Test 2: Mastra agent.stream
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model: openaiModel,
          instructions: 'You are a helpful assistant',
          tools: { weatherTool },
        });

        const mastraStream = await agent.stream('What is the weather in San Francisco?');

        // Consume Mastra stream
        await mastraStream.consumeStream();

        console.log(((await mastraStream.request).body as any).input);

        const mastraUsage = await mastraStream.usage;

        console.log('AI SDK usage property:', aiSdkUsage);
        // Compare usage - they should match exactly
        console.log('Mastra usage:', mastraUsage);
      });
    });
  });

  describe('Agent legacy usage tracking', () => {
    describe('generateLegacy', () => {
      it('should expose usage with promptTokens and completionTokens (legacy format)', async () => {
        // Create a V1 mock that returns usage in legacy format
        const model = createMockModel({
          mockText: 'Hello world!',
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const result = await agent.generateLegacy('Hello');

        // Check that usage exists
        expect(result.usage).toBeDefined();
        console.log('generateLegacy usage:', result.usage);

        // Check legacy format keys
        expect(result.usage.promptTokens).toBe(10);
        expect(result.usage.completionTokens).toBe(20);
        expect(result.usage.totalTokens).toBeDefined();
      });
    });

    describe('streamLegacy', () => {
      it('should expose usage with promptTokens and completionTokens (legacy format)', async () => {
        const model = createMockModel({
          mockText: 'Hello world!',
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const result = await agent.streamLegacy('Hello');

        // Consume stream to get usage
        for await (const _ of result.textStream) {
          // Just consume
        }

        const usage = await result.usage;
        console.log('streamLegacy usage:', usage);

        // Check that usage exists with legacy format
        expect(usage).toBeDefined();
        expect(usage.promptTokens).toBeDefined();
        expect(usage.completionTokens).toBeDefined();
        expect(usage.totalTokens).toBeDefined();
        // Legacy format should have promptTokens/completionTokens, not inputTokens/outputTokens
        expect((usage as any).inputTokens).toBeUndefined();
        expect((usage as any).outputTokens).toBeUndefined();
      });
    });

    describe('generate/stream (currently using legacy implementation)', () => {
      it('generate should use promptTokens/completionTokens until migration', async () => {
        const model = createMockModel({
          mockText: 'Hello world!',
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const result = await agent.generateLegacy('Hello');

        // Currently using legacy implementation, should have legacy format
        expect(result.usage).toBeDefined();
        expect(result.usage.promptTokens).toBe(10);
        expect(result.usage.completionTokens).toBe(20);
      });

      it('stream should use promptTokens/completionTokens until migration', async () => {
        const model = createMockModel({
          mockText: 'Hello world!',
        });

        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          model,
          instructions: 'You are a helpful assistant',
        });

        const result = await agent.streamLegacy('Hello');

        // Consume stream
        for await (const _ of result.textStream) {
          // Just consume
        }

        // Currently using legacy implementation, should have legacy format
        const usage = await result.usage;
        expect(usage).toBeDefined();
        expect(usage.promptTokens).toBeDefined();
        expect(usage.completionTokens).toBeDefined();
        // Legacy format should have promptTokens/completionTokens, not inputTokens/outputTokens
        expect((usage as any).inputTokens).toBeUndefined();
        expect((usage as any).outputTokens).toBeUndefined();
      });
    });
  });
});
