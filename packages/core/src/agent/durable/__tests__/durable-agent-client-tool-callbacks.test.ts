/**
 * DurableAgent client-tool onInputStart / onInputDelta callback tests.
 *
 * Verifies that tool-level onInputStart and onInputDelta callbacks are
 * invoked during durable streaming when the LLM streams tool-call input
 * (Bug 10 parity fix).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * Creates a MockLanguageModelV2 that streams tool-call input deltas
 * before the final tool-call chunk, then a text-only finish on the second call.
 */
function createStreamingToolInputModel(toolName: string, argChunks: string[]) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        // First call: stream tool-call input deltas, then a complete tool-call
        const chunks: any[] = [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
          {
            type: 'tool-input-start',
            id: 'tc-1',
            toolName,
          },
        ];

        // Add deltas (AI SDK uses `tool-input-delta` with `delta` field)
        for (const delta of argChunks) {
          chunks.push({
            type: 'tool-input-delta',
            id: 'tc-1',
            delta,
          });
        }

        // End streaming + full tool-call
        chunks.push({
          type: 'tool-input-end',
          id: 'tc-1',
        });
        chunks.push({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'tc-1',
          toolName,
          args: argChunks.join(''),
        });
        chunks.push({
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        });

        return {
          stream: convertArrayToReadableStream(chunks),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }

      // Second call: text response
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-delta', textDelta: 'Done' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;
}

describe('DurableAgent client-tool callbacks (Bug 10)', () => {
  let _mastra: Mastra;
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await _mastra?.close?.();
    pubsub?.removeAllListeners?.();
  });

  it('invokes onInputStart when tool-call-input-streaming-start chunk arrives', async () => {
    const onInputStartSpy = vi.fn();

    const model = createStreamingToolInputModel('test-tool', ['{"q', 'uery":', '"hello"}']);

    const baseAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent',
      model,
      tools: {
        'test-tool': {
          description: 'A test tool',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }: { query: string }) => ({ result: query }),
          onInputStart: onInputStartSpy,
        },
      },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    _mastra = new Mastra({
      agents: { 'test-agent': durableAgent },
      storage: new InMemoryStore(),
    });

    const { output } = await durableAgent.stream('test prompt', {
      maxSteps: 3,
    });

    // Consume the stream
    await output.consumeStream();

    expect(onInputStartSpy).toHaveBeenCalledTimes(1);
    expect(onInputStartSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'tc-1',
      }),
    );
  });

  it('invokes onInputDelta for each tool-call-delta chunk', async () => {
    const onInputDeltaSpy = vi.fn();

    const argChunks = ['{"q', 'uery":', '"hello"}'];
    const model = createStreamingToolInputModel('test-tool', argChunks);

    const baseAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent',
      model,
      tools: {
        'test-tool': {
          description: 'A test tool',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }: { query: string }) => ({ result: query }),
          onInputDelta: onInputDeltaSpy,
        },
      },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    _mastra = new Mastra({
      agents: { 'test-agent': durableAgent },
      storage: new InMemoryStore(),
    });

    const { output } = await durableAgent.stream('test prompt', {
      maxSteps: 3,
    });

    // Consume the stream
    await output.consumeStream();

    expect(onInputDeltaSpy).toHaveBeenCalledTimes(argChunks.length);

    // Each delta call should include the argsTextDelta fragment
    for (let i = 0; i < argChunks.length; i++) {
      expect(onInputDeltaSpy).toHaveBeenNthCalledWith(
        i + 1,
        expect.objectContaining({
          toolCallId: 'tc-1',
          inputTextDelta: argChunks[i],
        }),
      );
    }
  });
});
