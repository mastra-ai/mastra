import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MockLanguageModelV3 } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { StructuredOutputProcessor } from '../../processors/processors/structured-output';
import { Agent } from '../agent';

function createModel(version: 'v2' | 'v3', respond: (prompt: unknown) => string | Promise<string>) {
  const chunks = (text: string) => [
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'response', modelId: 'mock-model', timestamp: new Date(0) },
    { type: 'text-start' as const, id: 'text' },
    { type: 'text-delta' as const, id: 'text', delta: text },
    { type: 'text-end' as const, id: 'text' },
  ];
  if (version === 'v2') {
    return new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => ({
        content: [{ type: 'text', text: await respond(prompt) }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        warnings: [],
      }),
      doStream: async ({ prompt }) => ({
        stream: convertArrayToReadableStream([
          ...chunks(await respond(prompt)),
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20 } },
        ]),
      }),
    });
  }
  return new MockLanguageModelV3({
    doGenerate: async ({ prompt }) => ({
      content: [{ type: 'text', text: await respond(prompt) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
    doStream: async ({ prompt }) => ({
      stream: convertArrayToReadableStream([
        ...chunks(await respond(prompt)),
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
        },
      ]),
    }),
  });
}

describe.each(['v2', 'v3'] as const)('separate structuring model retries (%s)', version => {
  describe.each(['generate', 'stream'] as const)('%s', method => {
    it.each(['warn', 'fallback'] as const)('does not retry %s failures', async errorStrategy => {
      let structuringCalls = 0;
      const agent = new Agent({
        id: 'structured-output-strategy',
        name: 'Structured output strategy',
        model: createModel(version, () => 'There are three files.'),
      });
      const result = await agent[method]('Count the files.', {
        maxProcessorRetries: 2,
        structuredOutput: {
          schema: z.object({ count: z.number() }),
          model: createModel(version, () => {
            structuringCalls++;
            return '{"count":"invalid"}';
          }),
          errorStrategy,
          fallbackValue: { count: 0 },
        },
      });
      if (method === 'stream' && 'fullStream' in result) {
        for await (const _chunk of result.fullStream) {
          // Drain the stream before inspecting its final result.
        }
      }
      expect(structuringCalls).toBe(1);
      expect(await result.tripwire).toBeUndefined();
      expect(await result.finishReason).toBe('stop');
      expect(await result.object).toEqual(errorStrategy === 'fallback' ? { count: 0 } : undefined);
    });

    it.each(['sequential', 'concurrent'] as const)(
      'isolates a configured processor across %s requests',
      async execution => {
        let structuringCalls = 0;
        const processor = new StructuredOutputProcessor({
          schema: z.object({ count: z.number() }),
          model: createModel(version, () => {
            structuringCalls++;
            return '{"count":3}';
          }),
        });
        const agent = new Agent({
          id: 'structured-output-shared',
          name: 'Structured output shared',
          model: createModel(version, () => 'There are three files.'),
          outputProcessors: [processor],
        });
        const request = async () => {
          const result = await agent[method]('Count the files.');
          if (method === 'stream' && 'fullStream' in result) {
            for await (const _chunk of result.fullStream) {
              // Drain the stream before inspecting its final result.
            }
          }
          expect(await result.object).toEqual({ count: 3 });
          expect(await result.tripwire).toBeUndefined();
          expect(await result.finishReason).toBe('stop');
        };
        if (execution === 'concurrent') {
          await Promise.all([request(), request()]);
        } else {
          await request();
          await request();
        }
        expect(structuringCalls).toBe(2);
      },
    );

    it('isolates failure state across sequential requests on the same agent', async () => {
      let structuringCalls = 0;
      const agent = new Agent({
        id: 'structured-output-sequential',
        name: 'Structured output sequential',
        model: createModel(version, () => 'There are three files.'),
      });
      const options = {
        structuredOutput: {
          schema: z.object({ count: z.number() }),
          model: createModel(version, () => {
            structuringCalls++;
            return structuringCalls === 1 ? '{"count":"invalid"}' : '{"count":3}';
          }),
        },
      };
      for (let request = 0; request < 2; request++) {
        const result = await agent[method]('Count the files.', options);
        if (method === 'stream' && 'fullStream' in result) {
          for await (const _chunk of result.fullStream) {
            // Drain the stream before inspecting its final result.
          }
        }
        expect(await result.object).toEqual(request === 0 ? undefined : { count: 3 });
        expect(await result.finishReason).toBe(request === 0 ? 'tripwire' : 'stop');
        if (request === 1) expect(await result.tripwire).toBeUndefined();
      }
      expect(structuringCalls).toBe(2);
    });

    it('isolates a retrying request from a concurrent successful request', async () => {
      let primaryCalls = 0;
      let structuringCalls = 0;
      let initialStructuringCalls = 0;
      let releaseInitialStructuringCalls!: () => void;
      const initialStructuringCallsStarted = new Promise<void>(resolve => {
        releaseInitialStructuringCalls = resolve;
      });
      const processor = new StructuredOutputProcessor({
        schema: z.object({ count: z.number() }),
        model: createModel(version, async prompt => {
          structuringCalls++;
          const serializedPrompt = JSON.stringify(prompt);
          const shouldRetry = serializedPrompt.includes('needs retry');
          if (structuringCalls <= 2) {
            initialStructuringCalls++;
            if (initialStructuringCalls === 2) releaseInitialStructuringCalls();
            await initialStructuringCallsStarted;
          }
          if (shouldRetry && structuringCalls <= 2) return '{"count":"invalid"}';
          return JSON.stringify({ count: shouldRetry ? 1 : 2 });
        }),
      });
      const agent = new Agent({
        id: 'structured-output-concurrent-retry',
        name: 'Structured output concurrent retry',
        model: createModel(version, prompt => {
          primaryCalls++;
          return JSON.stringify(prompt).includes('Retry request') ? 'needs retry' : 'succeeds immediately';
        }),
        outputProcessors: [processor],
      });
      const request = async (input: string) => {
        const result = await agent[method](input, { maxProcessorRetries: 1 });
        if (method === 'stream' && 'fullStream' in result) {
          for await (const chunk of result.fullStream) {
            expect(chunk.type).not.toBe('error');
          }
        }
        expect(await result.tripwire).toBeUndefined();
        expect(await result.finishReason).toBe('stop');
        return result.object;
      };

      const [retriedObject, successfulObject] = await Promise.all([
        request('Retry request'),
        request('Successful request'),
      ]);

      expect(await retriedObject).toEqual({ count: 1 });
      expect(await successfulObject).toEqual({ count: 2 });
      expect(primaryCalls).toBe(3);
      expect(structuringCalls).toBe(3);
    });

    it.each([
      { budget: 2, failures: 0, attempts: 1, succeeds: true },
      { budget: 2, failures: 1, attempts: 2, succeeds: true },
      { budget: undefined, failures: 1, attempts: 1, succeeds: false },
      { budget: 0, failures: 1, attempts: 1, succeeds: false },
      { budget: 2, failures: Infinity, attempts: 3, succeeds: false },
    ])('budget $budget, failures $failures', async ({ budget, failures, attempts, succeeds }) => {
      let structuringCalls = 0;
      const prompts: unknown[] = [];
      const agent = new Agent({
        id: 'structured-output-retry',
        name: 'Structured output retry',
        instructions: 'Summarize the files.',
        model: createModel(version, prompt => {
          prompts.push(prompt);
          return 'There are three files.';
        }),
      });
      const options = {
        maxProcessorRetries: budget,
        structuredOutput: {
          schema: z.object({ count: z.number(), stale: z.string().optional() }),
          model: createModel(version, () => {
            structuringCalls++;
            return JSON.stringify(
              structuringCalls <= failures ? { count: 'invalid', stale: 'rejected' } : { count: 3 },
            );
          }),
        },
      };
      const result = await agent[method]('Count the files.', options);
      if (method === 'stream' && 'fullStream' in result) {
        for await (const chunk of result.fullStream) {
          expect(chunk.type).not.toBe('error');
        }
      }
      expect(structuringCalls).toBe(attempts);
      expect(prompts).toHaveLength(attempts);
      if (succeeds) {
        expect(await result.object).toEqual({ count: 3 });
        expect(await result.finishReason).toBe('stop');
        expect(await result.tripwire).toBeUndefined();
        if (failures > 0) expect(JSON.stringify(prompts[1])).toContain('Structuring failed');
      } else {
        expect(await result.finishReason).toBe('tripwire');
        expect(await result.tripwire).toMatchObject({ retry: true });
        expect((await result.tripwire)?.reason.match(/\[StructuredOutputProcessor\]/g)).toHaveLength(1);
        expect(await result.object).toBeUndefined();
      }
    });
  });
});
