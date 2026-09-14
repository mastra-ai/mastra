import type { LanguageModelV4, LanguageModelV4Usage, LanguageModelV4StreamPart } from '@ai-sdk/provider-v7';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createMockModel } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

describe('Agent usage tracking', () => {
  it.each(['generate', 'stream'] as const)('accumulates nested V4 usage across tool steps with %s', async mode => {
    let calls = 0;
    const nextResult = () => {
      const first = calls++ === 0;
      // The extra total wrapper is malformed provider data, not the V4 contract.
      const usage = {
        inputTokens: { total: { total: first ? 100 : 200, noCache: first ? 60 : 160, cacheRead: 30, cacheWrite: 10 } },
        outputTokens: { total: { total: first ? 20 : 30, text: first ? 15 : 25, reasoning: 5 } },
      } as unknown as LanguageModelV4Usage;
      return {
        first,
        usage,
        finishReason: { unified: first ? ('tool-calls' as const) : ('stop' as const), raw: undefined },
      };
    };
    const model: LanguageModelV4 = {
      specificationVersion: 'v4',
      provider: 'test',
      modelId: 'nested-usage',
      supportedUrls: {},
      doGenerate: async () => {
        const { first, usage, finishReason } = nextResult();
        return {
          content: first
            ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' }]
            : [{ type: 'text', text: 'Done' }],
          usage,
          finishReason,
          warnings: [],
        };
      },
      doStream: async () => {
        const { first, usage, finishReason } = nextResult();
        const parts: LanguageModelV4StreamPart[] = first
          ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' }]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Done' },
              { type: 'text-end', id: 'text-1' },
            ];
        parts.push({ type: 'finish', usage, finishReason });
        return { stream: convertArrayToReadableStream(parts) };
      },
    };
    const execute = vi.fn(async () => ({ value: 'ok' }));
    const agent = new Agent({
      id: 'nested-usage',
      name: 'Nested usage',
      instructions: 'Use lookup then respond.',
      model,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up a value',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute,
        }),
      },
    });
    const result = await agent[mode]('Look up a value', { maxSteps: 2 });
    if (mode === 'stream' && 'fullStream' in result) {
      for await (const _chunk of result.fullStream) {
        // Drain the stream so both steps finish.
      }
    }
    expect(calls).toBe(2);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(await result.usage).toMatchObject({
      inputTokens: 300,
      outputTokens: 50,
      totalTokens: 350,
      cachedInputTokens: 60,
      cacheCreationInputTokens: 20,
      reasoningTokens: 10,
    });
    expect(await result.totalUsage).toEqual(await result.usage);
    expect((await result.steps).map(step => step.usage)).toMatchObject([
      { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
    ]);
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello world!' },
                { type: 'text-end', id: 'text-1' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello ' },
                { type: 'text-delta', id: 'text-1', delta: 'world!' },
                { type: 'text-end', id: 'text-1' },
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
          version: 'v1',
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
          version: 'v1',
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
          version: 'v1',
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
          version: 'v1',
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
