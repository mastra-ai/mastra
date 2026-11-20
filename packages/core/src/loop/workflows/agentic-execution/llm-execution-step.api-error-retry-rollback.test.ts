/**
 * Regression for GitHub issue #26081.
 *
 * A provider can emit text and then a retryable error inside an already-open stream.
 * When an error processor answers that error with a retry, the failed attempt's partial
 * text was left in the MessageList and in the run's aggregated text, so the recovered
 * answer came out as "<failed prefix><recovered answer>" and the retry request replayed the
 * failed prefix to the model as an assistant message.
 *
 * @see https://github.com/mastra-ai/mastra/issues/26081
 */

import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockLanguageModelV2, convertArrayToReadableStream } from '../../../agent/__tests__/mock-model';
import { Agent } from '../../../agent/agent';
import { createDurableAgent } from '../../../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Processor } from '../../../processors';
import { createTool } from '../../../tools';

const FAILED_PREFIX = 'The answer is ';
const RECOVERED_TEXT = 'The answer is 42.';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const retryableError = () =>
  new APICallError({
    message: 'service unavailable',
    url: 'https://api.example.com/v1/messages',
    requestBodyValues: {},
    statusCode: 503,
    responseBody: '{"error":"unavailable"}',
    isRetryable: true,
  });

const retryOnceProcessor = (): Processor => ({
  id: 'retry-once',
  processAPIError: async ({ retryCount }) => ({ retry: retryCount === 0 }),
});

function textStream(id: string, text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: `${id}-text` },
    { type: 'text-delta', id: `${id}-text`, delta: text },
    { type: 'text-end', id: `${id}-text` },
    { type: 'finish', finishReason: 'stop', usage },
  ]);
}

function failingTextStream(id: string, text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: `${id}-text` },
    { type: 'text-delta', id: `${id}-text`, delta: text },
    { type: 'error', error: retryableError() },
  ]);
}

function assistantText(prompt: any[]): string[] {
  return prompt
    .filter(m => m.role === 'assistant')
    .flatMap(m => (m.content as any[]).filter(p => p.type === 'text').map(p => p.text));
}

function responseTexts(messages: any[]): string[] {
  return messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => {
      if (typeof m.content === 'string') return [m.content];
      // Model messages carry an array of parts; MastraDBMessages keep them under content.parts.
      const parts: any[] = Array.isArray(m.content) ? m.content : (m.content?.parts ?? []);
      return parts.filter(p => p.type === 'text').map(p => p.text);
    });
}

describe('#26081 — mid-stream API-error retry discards the failed attempt', () => {
  it('drops the failed partial text from the final answer, response messages and retry prompt', async () => {
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream:
            prompts.length === 1 ? failingTextStream('resp-1', FAILED_PREFIX) : textStream('resp-2', RECOVERED_TEXT),
        };
      },
    });

    const agent = new Agent({
      id: 'api-error-retry-agent',
      name: 'API error retry agent',
      instructions: 'Answer.',
      model,
      errorProcessors: [retryOnceProcessor()],
    });

    const output = await agent.stream('What is the answer?', { maxSteps: 1 });
    const streamedText: string[] = [];
    for await (const chunk of output.textStream) streamedText.push(chunk);

    expect(prompts).toHaveLength(2);
    expect(assistantText(prompts[1]!)).toEqual([]);

    expect(await output.text).toBe(RECOVERED_TEXT);
    expect(await output.finishReason).toBe('stop');
    const response = await output.response;
    expect(responseTexts(response.messages)).toEqual([RECOVERED_TEXT]);
    expect(responseTexts(response.dbMessages ?? [])).toEqual([RECOVERED_TEXT]);
    // The failed attempt's prefix was streamed live before the error; the recovered answer follows it.
    expect(streamedText.join('')).toBe(FAILED_PREFIX + RECOVERED_TEXT);
  });

  it('drops the failed partial text when the error is thrown on a non-last fallback model and retried', async () => {
    const prompts: any[][] = [];
    const primary = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream:
            prompts.length === 1 ? failingTextStream('resp-1', FAILED_PREFIX) : textStream('resp-2', RECOVERED_TEXT),
        };
      },
    });
    const secondary = new MockLanguageModelV2({
      doStream: async () => {
        throw new Error('the fallback model must not be reached when the primary is retried');
      },
    });

    const agent = new Agent({
      id: 'api-error-retry-fallback-agent',
      name: 'API error retry fallback agent',
      instructions: 'Answer.',
      model: [
        { model: primary, maxRetries: 0 },
        { model: secondary, maxRetries: 0 },
      ],
      errorProcessors: [retryOnceProcessor()],
    });

    const output = await agent.stream('What is the answer?', { maxSteps: 1 });
    await output.consumeStream();

    expect(prompts).toHaveLength(2);
    expect(assistantText(prompts[1]!)).toEqual([]);
    expect(await output.text).toBe(RECOVERED_TEXT);
    const response = await output.response;
    expect(responseTexts(response.messages)).toEqual([RECOVERED_TEXT]);
  });

  it('keeps accepted earlier steps of the turn when a later step fails mid-stream and is retried', async () => {
    const prompts: any[][] = [];
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input back.',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ text }),
    });

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        const call = prompts.length;
        if (call === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'echo',
                input: JSON.stringify({ text: 'hi' }),
                providerExecuted: false,
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: call === 2 ? failingTextStream('resp-2', FAILED_PREFIX) : textStream('resp-3', RECOVERED_TEXT),
        };
      },
    });

    const agent = new Agent({
      id: 'api-error-retry-multistep-agent',
      name: 'API error retry multistep agent',
      instructions: 'Answer.',
      model,
      tools: { echo: echoTool },
      errorProcessors: [retryOnceProcessor()],
    });

    const output = await agent.stream('What is the answer?', { maxSteps: 3 });
    await output.consumeStream();

    expect(prompts).toHaveLength(3);
    const retryPrompt = prompts[2]!;
    expect(assistantText(retryPrompt)).toEqual([]);
    const retryToolCalls = retryPrompt
      .filter(m => m.role === 'assistant')
      .flatMap(m => (m.content as any[]).filter(p => p.type === 'tool-call'));
    expect(retryToolCalls.map(p => p.toolCallId)).toEqual(['call-1']);

    expect(await output.text).toBe(RECOVERED_TEXT);
    const response = await output.response;
    expect(responseTexts(response.messages)).toEqual([RECOVERED_TEXT]);

    // The failed request is re-attempted within the recovered step, not reported as a step of
    // its own (COR-1554), and that step carries none of the failed attempt's partial text.
    const steps = await output.steps;
    expect(steps.map(step => step.finishReason)).toEqual(['tool-calls', 'stop']);
    expect(steps[1]!.text).toBe(RECOVERED_TEXT);
    expect(steps[1]!.toolCalls).toEqual([]);
  });

  it("does not report the failed attempt's tool calls or sources on the recovered step", async () => {
    let calls = 0;
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input back.',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ text }),
    });
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream:
            calls === 1
              ? convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
                  { type: 'source', sourceType: 'url', id: 'source-1', url: 'https://example.com', title: 'x' },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'echo',
                    input: JSON.stringify({ text: 'hi' }),
                    providerExecuted: false,
                  },
                  { type: 'error', error: retryableError() },
                ])
              : textStream('resp-2', RECOVERED_TEXT),
        };
      },
    });
    const agent = new Agent({
      id: 'api-error-retry-step-parts',
      name: 'API error retry step parts',
      instructions: 'Answer.',
      model,
      tools: { echo: echoTool },
      errorProcessors: [retryOnceProcessor()],
    });

    const output = await agent.stream('What is the answer?', { maxSteps: 3 });
    await output.consumeStream();

    expect(calls).toBe(2);
    const steps = await output.steps;
    expect(steps).toHaveLength(1);
    expect(steps[0]!.text).toBe(RECOVERED_TEXT);
    expect(steps[0]!.toolCalls).toEqual([]);
    expect(steps[0]!.sources).toEqual([]);
    // The run drops the failed attempt's sources but keeps its call: the eager tool already ran and
    // its result was carried into the retried request.
    const full = await output.getFullOutput();
    expect(full.sources).toEqual([]);
    expect(full.toolCalls.map(call => call.payload.toolCallId)).toEqual(['call-1']);
    expect(JSON.stringify(model.doStreamCalls[1]!.prompt)).toContain('call-1');
  });

  it.each([
    { failedAttempts: 1, args: ['first'] },
    { failedAttempts: 2, args: ['first', 'second'] },
  ])(
    "reports the last request's args for a call repeated under the same id after $failedAttempts failed attempt(s)",
    async ({ failedAttempts, args }) => {
      let calls = 0;
      const executed: string[] = [];
      const echoTool = createTool({
        id: 'echo',
        description: 'Echo the input back.',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => {
          executed.push(text);
          return { text };
        },
      });
      const toolCall = (text: string) => ({
        type: 'tool-call' as const,
        toolCallId: 'call-1',
        toolName: 'echo',
        input: JSON.stringify({ text }),
        providerExecuted: false,
      });
      const model = new MockLanguageModelV2({
        doStream: async () => {
          calls++;
          const start = [
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `resp-${calls}`, modelId: 'mock', timestamp: new Date(0) },
          ];
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream:
              calls <= failedAttempts
                ? convertArrayToReadableStream([
                    ...start,
                    toolCall(args[calls - 1]!),
                    { type: 'error', error: retryableError() },
                  ])
                : calls === failedAttempts + 1
                  ? convertArrayToReadableStream([
                      ...start,
                      toolCall('final'),
                      {
                        type: 'finish',
                        finishReason: 'tool-calls',
                        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                      },
                    ])
                  : textStream(`resp-${calls}`, RECOVERED_TEXT),
          };
        },
      });
      const agent = new Agent({
        id: 'api-error-retry-same-call-id',
        name: 'API error retry same call id',
        instructions: 'Answer.',
        model,
        tools: { echo: echoTool },
        errorProcessors: [
          { id: 'retry', processAPIError: async ({ retryCount }) => ({ retry: retryCount < failedAttempts }) },
        ],
      });

      const output = await agent.stream('What is the answer?', { maxSteps: 3, eagerToolExecution: false });
      await output.consumeStream();

      expect(calls).toBe(failedAttempts + 2);
      expect(executed).toEqual(['final']);
      const steps = await output.steps;
      expect(steps[0]!.toolCalls.map(call => call.payload.args)).toEqual([{ text: 'final' }]);
      const full = await output.getFullOutput();
      expect(full.toolCalls.map(call => call.payload.args)).toEqual([{ text: 'final' }]);
    },
  );

  it('does not carry a structured object from the failed attempt onto the recovered one', async () => {
    const schema = z.object({ answer: z.number() });
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream:
            prompts.length === 1
              ? failingTextStream('resp-1', JSON.stringify({ answer: 41 }))
              : textStream('resp-2', JSON.stringify({ answer: 42 })),
        };
      },
    });
    const agent = new Agent({
      id: 'api-error-retry-object',
      name: 'API error retry object',
      instructions: 'Answer.',
      model,
      errorProcessors: [retryOnceProcessor()],
    });

    const output = await agent.stream('q', { maxSteps: 1, structuredOutput: { schema } });

    expect(await output.object).toEqual({ answer: 42 });
    expect(prompts).toHaveLength(2);
  });

  it("drops the failed partial text from a durable agent's final answer", async () => {
    const prompts: any[][] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt as any[]);
        const stream =
          prompts.length === 1 ? failingTextStream('resp-1', FAILED_PREFIX) : textStream('resp-2', RECOVERED_TEXT);
        return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
      },
    });
    const agent = new Agent({
      id: 'durable-api-error-retry-rollback',
      name: 'durable-api-error-retry-rollback',
      instructions: 'Answer.',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [retryOnceProcessor()],
    });
    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });

    const { output, cleanup } = await durableAgent.stream('q', { maxSteps: 1 });
    try {
      expect(await output.text).toBe(RECOVERED_TEXT);
      expect(prompts).toHaveLength(2);
      expect(assistantText(prompts[1]!)).toEqual([]);
    } finally {
      await cleanup?.();
    }
  });
});
