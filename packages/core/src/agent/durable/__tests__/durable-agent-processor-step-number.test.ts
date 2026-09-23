/**
 * DurableAgent processor stepNumber tests.
 *
 * Verifies that every processor hook receives the current zero-based step
 * index and the running step list in durable runs, matching the non-durable
 * agentic loop. Regression test for #24279.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Processor } from '../../../processors';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTwoStepToolThenTextModel(toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify({}), providerExecuted: false },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'final' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

type Observed = { stepNumbers: number[]; stepCounts: number[] };

function createCaptureProcessor() {
  const observed: Record<'input' | 'request' | 'response' | 'output', Observed> = {
    input: { stepNumbers: [], stepCounts: [] },
    request: { stepNumbers: [], stepCounts: [] },
    response: { stepNumbers: [], stepCounts: [] },
    output: { stepNumbers: [], stepCounts: [] },
  };
  const record = (key: keyof typeof observed) => (args: { stepNumber: number; steps: unknown[] }) => {
    observed[key].stepNumbers.push(args.stepNumber);
    observed[key].stepCounts.push(args.steps.length);
  };
  const processor: Processor = {
    id: 'capture-steps',
    processInputStep: async args => {
      record('input')(args);
      return args.messageList;
    },
    processLLMRequest: async args => {
      record('request')(args);
    },
    processLLMResponse: async args => {
      record('response')(args);
    },
    processOutputStep: async args => {
      record('output')(args);
      return args.messageList;
    },
  };
  return { processor, observed };
}

async function drain(stream: ReadableStream<any>) {
  for await (const _ of stream) {
    // consume
  }
}

function createAgent(processor: Processor) {
  const tool = createTool({
    id: 'echoTool',
    description: 'echo',
    inputSchema: z.object({}),
    execute: async () => 'done',
  });
  return new Agent({
    id: 'step-number-agent',
    name: 'Step Number Agent',
    instructions: 'noop',
    model: createTwoStepToolThenTextModel('echoTool') as LanguageModelV2,
    tools: { echoTool: tool },
    // processOutputStep only runs for output processors
    inputProcessors: [processor],
    outputProcessors: [processor],
  });
}

describe('DurableAgent processor stepNumber', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('passes the current step index and running step list to every processor hook', async () => {
    const { processor, observed } = createCaptureProcessor();
    const durableAgent = createDurableAgent({ agent: createAgent(processor), pubsub });

    const { output, cleanup } = await durableAgent.stream('go', { maxSteps: 2 });
    await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    for (const hook of ['input', 'request', 'response', 'output'] as const) {
      expect(observed[hook].stepNumbers, `${hook} stepNumber`).toEqual([0, 1]);
      expect(observed[hook].stepCounts, `${hook} steps.length`).toEqual([0, 1]);
    }
  });

  it('matches the non-durable agent loop', async () => {
    const { processor, observed } = createCaptureProcessor();
    const agent = createAgent(processor);

    const result = await agent.stream('go', { maxSteps: 2 });
    await drain(result.fullStream as unknown as ReadableStream<any>);

    for (const hook of ['input', 'request', 'response', 'output'] as const) {
      expect(observed[hook].stepNumbers, `${hook} stepNumber`).toEqual([0, 1]);
      expect(observed[hook].stepCounts, `${hook} steps.length`).toEqual([0, 1]);
    }
  });
});
