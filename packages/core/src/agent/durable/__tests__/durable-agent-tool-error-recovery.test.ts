/**
 * DurableAgent tool-error recovery tests.
 *
 * Regression coverage for #17789: the durable LLM-mapping step used to force
 * isContinued = false whenever every tool call in a step errored, so a single
 * throwing tool ended the run and the error result never reached the model.
 * The non-durable Agent.stream() loop keeps going and lets the model see the
 * error and self-correct. These tests assert the durable loop now matches that,
 * and that maxSteps still bounds a tool that keeps failing.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const toolCallChunks = (toolName: string, toolCallId: string, args: object): any[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: toolCallId, modelId: 'mock-model-id', timestamp: new Date(0) },
  { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(args), providerExecuted: false },
  { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
];

const textChunks = (text: string): any[] => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'final', modelId: 'mock-model-id', timestamp: new Date(0) },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: text },
  { type: 'text-end', id: 'text-1' },
  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
];

describe('DurableAgent tool-error recovery (#17789)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('continues the loop after a step where the only tool errored, and feeds the error back to the model', async () => {
    // Call 1: model calls the (throwing) tool. Call 2: model recovers with text.
    let callCount = 0;
    const doStream = vi.fn(async (_options: any) => {
      callCount += 1;
      return {
        stream: convertArrayToReadableStream(
          callCount === 1
            ? toolCallChunks('flakyTool', 'call-1', { id: 'bad-id' })
            : textChunks('Recovered after the tool error'),
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    });

    const flakyTool = createTool({
      id: 'flakyTool',
      description: 'Throws on a bad id',
      inputSchema: z.object({ id: z.string() }),
      execute: async () => {
        throw new Error('Invalid id supplied to flakyTool');
      },
    });

    const baseAgent = new Agent({
      id: 'tool-error-recovery-agent',
      name: 'Tool Error Recovery Agent',
      instructions: 'Use the tool and recover if it fails.',
      model: new MockLanguageModelV2({ doStream }) as LanguageModelV2,
      tools: { flakyTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { output, cleanup } = await durableAgent.stream('Look up the record');
    await output.consumeStream();

    // Loop continued past the all-errored step: the model was called a 2nd time.
    expect(doStream).toHaveBeenCalledTimes(2);

    // The error result actually reached the model on the recovery call.
    const recoveryPrompt = JSON.stringify(doStream.mock.calls[1]?.[0]?.prompt ?? '');
    expect(recoveryPrompt).toContain('Invalid id supplied to flakyTool');

    // And the run produced the model's final text instead of ending on the tool part.
    const text = await output.text;
    expect(text).toContain('Recovered after the tool error');

    cleanup();
  });

  it('does not loop forever when a tool keeps failing — maxSteps bounds the run', async () => {
    // Model always calls the throwing tool, never recovers. maxSteps must stop it.
    const doStream = vi.fn(async (_options: any) => ({
      stream: convertArrayToReadableStream(toolCallChunks('alwaysFails', 'call-x', { id: 'bad' })),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }));

    const alwaysFails = createTool({
      id: 'alwaysFails',
      description: 'Always throws',
      inputSchema: z.object({ id: z.string() }),
      execute: async () => {
        throw new Error('permanent failure');
      },
    });

    const baseAgent = new Agent({
      id: 'tool-error-bound-agent',
      name: 'Tool Error Bound Agent',
      instructions: 'Keep trying the tool.',
      model: new MockLanguageModelV2({ doStream }) as LanguageModelV2,
      tools: { alwaysFails },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { output, cleanup } = await durableAgent.stream('Do the thing', { maxSteps: 3 });
    await output.consumeStream({ onError: () => {} });

    // Bounded by maxSteps rather than running forever.
    expect(doStream).toHaveBeenCalledTimes(3);

    cleanup();
  });
});
