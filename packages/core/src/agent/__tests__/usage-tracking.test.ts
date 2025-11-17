import { openai } from '@ai-sdk/openai-v5';
import { stepCountIs, streamText } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect } from 'vitest';
import z from 'zod';
import { createMockModel } from '../../test-utils/llm-mock';
import { Agent } from '../agent';

describe('Agent usage tracking', () => {
  describe('Usage tracking aisdk vs mastra', () => {
    const system = 'You are a helpful assistant';
    const prompt = 'Hello';

    it('Should be equal for usage and totalUsage for the same setup - no tools', async () => {
      const streamTextResult = streamText({
        prompt,
        model: openai('gpt-4o-mini'),
        system,
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        model: openai('gpt-4o-mini'),
        instructions: system,
      });

      const mastraStream = await agent.stream(prompt);

      await streamTextResult.consumeStream();
      await mastraStream.consumeStream();

      const streamTextUsage = await streamTextResult.usage;
      const mastraUsage = await mastraStream.usage;

      const streamTextTotalUsage = await streamTextResult.totalUsage;
      const mastraTotalUsage = await mastraStream.totalUsage;

      expect(streamTextTotalUsage).toEqual(mastraTotalUsage);
      expect(streamTextUsage).toEqual(mastraUsage);
    });

    it.only('Should be equal for usage and totalUsage for the same setup - with tools', async () => {
      const prompt = 'Call the test tool with the value "test"';

      const tool = {
        description: 'Test tool',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }: { value: string }) => {
          return {
            value,
          };
        },
      };

      const streamTextResult = streamText({
        prompt,
        model: openai('gpt-4o-mini'),
        system,
        stopWhen: stepCountIs(5),
        tools: {
          tool,
        },
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        model: openai('gpt-4o-mini'),
        instructions: system,
        tools: {
          tool,
        },
      });

      const mastraStream = await agent.stream(prompt);

      await streamTextResult.consumeStream();
      await mastraStream.consumeStream();

      const streamTextUsage = await streamTextResult.usage;
      console.log('streamTextUsage:', streamTextUsage);
      const mastraUsage = await mastraStream.usage;
      console.log('Mastra usage:', mastraUsage);

      const streamTextTotalUsage = await streamTextResult.totalUsage;
      console.log('streamTextTotalUsage:', streamTextTotalUsage);
      const mastraTotalUsage = await mastraStream.totalUsage;
      console.log('Mastra total usage:', mastraTotalUsage);
    });
  });

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
