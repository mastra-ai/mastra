import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

type Engine = 'durable' | 'evented';

function finishChunk(reason: 'stop' | 'tool-calls') {
  return {
    type: 'finish' as const,
    finishReason: reason,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  };
}

function toolCallingModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'tool-response', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName: 'step',
          input: '{}',
          providerExecuted: false,
        },
        finishChunk('tool-calls'),
      ]),
    }),
  });
}

function textModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      const text = callCount === 1 ? 'first' : 'second';
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: `text-response-${callCount}`,
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: `text-${callCount}` },
          { type: 'text-delta', id: `text-${callCount}`, delta: text },
          { type: 'text-end', id: `text-${callCount}` },
          finishChunk('stop'),
        ]),
      };
    },
  });
}

async function run(
  engine: Engine,
  model: LanguageModelV2,
  options: Record<string, unknown>,
  tools?: Record<string, unknown>,
  outputProcessors: any[] = [],
) {
  const stepFinishes: boolean[] = [];
  const pubsub = new EventEmitterPubSub();
  const id = `step-finish-${engine}-${Math.random()}`;
  const agent = new Agent({
    id,
    name: id,
    instructions: 'Follow the script.',
    model,
    tools: tools as any,
    outputProcessors: [
      {
        id: 'step-finish-recorder',
        async processOutputStream({ part }: any) {
          if (part.type === 'step-finish') {
            stepFinishes.push(part.payload?.stepResult?.isContinued);
          }
          return part;
        },
      },
      ...outputProcessors,
    ],
  });
  const wrapped = engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });
  new Mastra({ agents: { [id]: wrapped }, storage: new InMemoryStore(), logger: false });

  let cleanup: (() => void) | undefined;
  try {
    const result = await wrapped.stream('Run it.', options as any);
    cleanup = result.cleanup;
    await result.output.consumeStream();
    return stepFinishes;
  } finally {
    cleanup?.();
    await pubsub.close();
  }
}

describe.each<Engine>(['durable', 'evented'])('%s step-finish continuation state', engine => {
  const step = createTool({
    id: 'step',
    description: 'Completes one step.',
    inputSchema: z.object({}),
    execute: async () => ({ done: true }),
  });

  it('reports false when maxSteps stops a tool-calling iteration', async () => {
    const stepFinishes = await run(engine, toolCallingModel() as LanguageModelV2, { maxSteps: 1 }, { step });

    expect(stepFinishes).toEqual([false]);
  });

  it('preserves a completed text step continuation value when its output processor aborts the run', async () => {
    const abortController = new AbortController();
    const stepFinishes = await run(
      engine,
      textModel() as LanguageModelV2,
      { abortSignal: abortController.signal },
      undefined,
      [
        {
          id: 'abort-after-output-step',
          async processOutputStep({ messageList }: any) {
            abortController.abort();
            return messageList;
          },
        },
      ],
    );

    expect(stepFinishes).toEqual([false]);
  });

  it('reports false when stopWhen stops a tool-calling iteration', async () => {
    const stepFinishes = await run(
      engine,
      toolCallingModel() as LanguageModelV2,
      { maxSteps: 3, stopWhen: () => true },
      { step },
    );

    expect(stepFinishes).toEqual([false]);
  });

  it('reports true when iteration feedback continues a text-only iteration', async () => {
    let iteration = 0;
    const stepFinishes = await run(engine, textModel() as LanguageModelV2, {
      maxSteps: 3,
      onIterationComplete: () => {
        iteration++;
        return iteration === 1 ? { continue: true, feedback: 'Continue with feedback.' } : { continue: false };
      },
    });

    expect(stepFinishes).toEqual([true, false]);
  });
});
