/**
 * DurableAgent Callback Bridge Tests
 *
 * Verifies that pubsub-to-callback bridges deliver `onAbort` and
 * `onIterationComplete` events to user-supplied callbacks, mirroring the
 * non-durable Agent's behavior.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
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
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent callback bridge', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('onIterationComplete', () => {
    it('fires after each agentic-loop iteration including the final one', async () => {
      const echoTool = createTool({
        id: 'echo',
        description: 'Echoes input',
        inputSchema: z.object({ msg: z.string() }),
        execute: async () => 'echo:hi',
      });

      const mockModel = createToolCallThenTextModel('echo', { msg: 'hi' }, 'done');

      const baseAgent = new Agent({
        id: 'iteration-agent',
        name: 'Iteration Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
        tools: { echo: echoTool },
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const iterations: any[] = [];
      const { output, cleanup } = await durableAgent.stream('Run it', {
        maxSteps: 5,
        onIterationComplete: ctx => {
          iterations.push(ctx);
        },
      });

      await output.consumeStream();

      // Two iterations: one for the tool call, one for the final text step.
      expect(iterations.length).toBeGreaterThanOrEqual(2);
      // Final iteration must be marked isFinal.
      const last = iterations[iterations.length - 1];
      expect(last.isFinal).toBe(true);
      // First iteration is mid-loop and ran the tool call.
      expect(iterations[0].iteration).toBe(1);
      expect(iterations[0].isFinal).toBe(false);
      // Final iteration produced the text response.
      expect(last.text).toBe('done');
      expect(last.finishReason).toBe('stop');
      // Run identifiers and agent metadata are populated.
      expect(last.runId).toBeDefined();
      expect(last.agentId).toBe('iteration-agent');

      cleanup();
    });
  });

  describe('onAbort', () => {
    // End-to-end runtime abort coverage (`result.abort()` and external
    // `abortSignal`) lives in `durable-agent-abort.test.ts`. This unit-level
    // test pins the pubsub→callback bridge: publishing an ABORT event on the
    // run's stream topic should invoke the user callback regardless of how
    // the abort was triggered.
    it('invokes the user callback when an ABORT event is published', async () => {
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'hi' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });

      const baseAgent = new Agent({
        id: 'abort-agent',
        name: 'Abort Agent',
        instructions: 'Test',
        model: mockModel as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      let abortPayload: any;
      const { output, runId, cleanup } = await durableAgent.stream('Go', {
        onAbort: data => {
          abortPayload = data;
        },
      });

      // Publish a synthetic ABORT event on the run's stream topic. The bridge
      // should route it to onAbort regardless of the underlying stream.
      const { AGENT_STREAM_TOPIC, AgentStreamEventTypes } = await import('../constants');
      await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type: AgentStreamEventTypes.ABORT,
        runId,
        data: { steps: [] },
        timestamp: Date.now(),
      } as any);

      try {
        await output.consumeStream();
      } catch {
        // The bridge errors the stream after firing onAbort; expected.
      }

      expect(abortPayload).toBeDefined();
      expect(abortPayload.steps).toEqual([]);

      cleanup();
    });
  });
});
