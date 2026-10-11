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

    // The retried attempt reports no content of its own, not the accepted tool step's.
    const retried = (await output.steps).filter(step => (step.finishReason as string) === 'retry');
    expect(retried).toHaveLength(1);
    expect(retried[0]!.text).toBe('');
    expect(retried[0]!.content).toEqual([]);
  });

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
