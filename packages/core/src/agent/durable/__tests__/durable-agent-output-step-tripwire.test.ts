/**
 * DurableAgent processOutputStep abort parity with Agent (#22980).
 *
 * - abort(reason, { retry: true }) must call the model again, with the reason
 *   fed back, up to maxProcessorRetries.
 * - abort(reason, { retry: false }) must end the stream with a `finish` chunk
 *   whose reason is 'tripwire' and carry the processor's reason.
 */

import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTextModel(texts: string[]) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const text = texts[Math.min(prompts.length - 1, texts.length - 1)]!;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `resp-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

async function drain(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('DurableAgent processOutputStep abort', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function createAgent(model: MockLanguageModelV2, processor: Processor, inputProcessors: Processor[] = []) {
    const agent = new Agent({
      id: 'output-step-agent',
      name: 'Output Step Agent',
      instructions: 'You are a helpful assistant.',
      model: model as LanguageModelV2,
      inputProcessors,
      outputProcessors: [processor],
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({
      agents: { 'output-step-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    return durableAgent;
  }

  it('abort with retry: true calls the model again with the reason as feedback', async () => {
    const { model, prompts } = createTextModel(['bad response', 'improved response']);
    const retryCounts: number[] = [];
    const inputStepRetryCounts: number[] = [];
    const llmRequestRetryCounts: number[] = [];
    const llmResponseRetryCounts: number[] = [];
    const inputProcessor: Processor = {
      id: 'retry-count-observer',
      processInputStep: async ({ retryCount }) => {
        inputStepRetryCounts.push(retryCount);
      },
      processLLMRequest: async ({ retryCount }) => {
        llmRequestRetryCounts.push(retryCount);
      },
      processLLMResponse: async ({ retryCount }) => {
        llmResponseRetryCounts.push(retryCount);
      },
    };
    const processor: Processor = {
      id: 'quality-check',
      processOutputStep: async ({ text, abort, retryCount, messageList }) => {
        retryCounts.push(retryCount);
        if (text?.includes('bad response')) {
          abort('Response quality too low, please improve', { retry: true });
        }
        return messageList;
      },
    };

    const durableAgent = createAgent(model, processor, [inputProcessor]);
    const { output } = await durableAgent.stream('Hello', { maxProcessorRetries: 3 });
    const chunks = await drain(output.fullStream);

    expect(prompts).toHaveLength(2);
    expect(retryCounts).toEqual([0, 1]);
    expect(inputStepRetryCounts).toEqual([0, 1]);
    expect(llmRequestRetryCounts).toEqual([0, 1]);
    expect(llmResponseRetryCounts).toEqual([0, 1]);
    expect(JSON.stringify(prompts[1]!.at(-1))).toContain('Response quality too low, please improve');
    expect(JSON.stringify(prompts[1])).not.toContain('bad response');

    expect(chunks.map(c => c.type)).not.toContain('tripwire');
    // The rejected step says more is coming, so channel rendering keeps going.
    expect(chunks.find(c => c.type === 'step-finish')?.payload.stepResult.isContinued).toBe(true);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(await output.finishReason).toBe('stop');
    expect(await output.text).toBe('improved response');
    expect(output.tripwire).toBeFalsy();
  });

  it('abort with retry: true on a response with tool calls drops that step and skips its tools', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `resp-${calls}`, modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: calls === 1 ? 'bad response' : 'improved response' },
            { type: 'text-end', id: 't' },
            ...(calls === 1
              ? [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', input: '{}' }]
              : []),
            {
              type: 'finish',
              finishReason: calls === 1 ? 'tool-calls' : 'stop',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
    const processor: Processor = {
      id: 'quality-check',
      processOutputStep: async ({ text, abort, messageList }) => {
        if (text?.includes('bad response')) {
          abort('Response quality too low, please improve', { retry: true });
        }
        return messageList;
      },
    };

    const durableAgent = createAgent(model, processor);
    const { output } = await durableAgent.stream('Hello', { maxProcessorRetries: 3 });
    await drain(output.fullStream);

    expect(calls).toBe(2);
    const steps = await output.steps;
    expect(steps.map(step => step.finishReason)).toEqual(['retry', 'stop']);
    expect(steps[0]!.text).toBe('');
    expect(await output.toolResults).toHaveLength(0);
    expect(await output.text).toBe('improved response');
  });

  it('abort with retry: false ends the stream with finish and reason tripwire', async () => {
    const { model, prompts } = createTextModel(['Well, damn...']);
    const processor: Processor = {
      id: 'no-swearing',
      processOutputStep: async ({ abort, messageList }) => {
        abort('Contains bad words', { retry: false });
        return messageList;
      },
    };

    const durableAgent = createAgent(model, processor);
    const { output } = await durableAgent.stream('Hello', { maxProcessorRetries: 3 });
    const chunks = await drain(output.fullStream);

    expect(prompts).toHaveLength(1);
    expect(chunks.map(c => c.type)).not.toContain('tripwire');
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(await output.finishReason).toBe('tripwire');
    expect(output.tripwire).toMatchObject({ reason: 'Contains bad words', processorId: 'no-swearing' });
  });

  it('abort with retry: true stops as tripwire once maxProcessorRetries is used up', async () => {
    const { model, prompts } = createTextModel(['bad response']);
    const processor: Processor = {
      id: 'quality-check',
      processOutputStep: async ({ abort, messageList }) => {
        abort('Still not good enough', { retry: true });
        return messageList;
      },
    };

    const durableAgent = createAgent(model, processor);
    const { output } = await durableAgent.stream('Hello', { maxProcessorRetries: 1 });
    const chunks = await drain(output.fullStream);

    expect(prompts).toHaveLength(2);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(await output.finishReason).toBe('tripwire');
    expect(output.tripwire).toMatchObject({ reason: 'Still not good enough', processorId: 'quality-check' });
  });
});
