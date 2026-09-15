/**
 * DurableAgent onIterationComplete callback result handling tests
 *
 * Verifies that the durable `dowhile` predicate honors the return value of
 * `onIterationComplete` — specifically:
 *
 * Bug 15: `{ continue: false }` stops the loop early.
 * Bug 15: `{ continue: true }` forces the loop to continue if under maxSteps.
 * Bug 13: `{ continue: false, feedback }` allows one more LLM turn with the
 *          feedback message, then stops (two-phase stop via pendingFeedbackStop).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

let callCount = 0;

/**
 * Model that always calls a tool on the first N calls, then stops.
 * This forces the agentic loop to iterate multiple times.
 */
function makeToolCallingModel(toolCallsBeforeStop: number) {
  callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount <= toolCallsBeforeStop) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `resp-${callCount}`, modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: `tc-${callCount}`,
              toolName: 'myTool',
              input: JSON.stringify({ x: callCount }),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `resp-${callCount}`, modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'final-text' },
          { type: 'text-delta', id: 'final-text', delta: 'Done!' },
          { type: 'text-end', id: 'final-text' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/**
 * Model that always calls a tool (never naturally stops). Used to test
 * that callback-driven stopping actually works.
 */
function makeNeverStoppingModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `resp-${call}`, modelId: 'mock-model', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: `tc-${call}`,
            toolName: 'myTool',
            input: JSON.stringify({ x: call }),
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function makeAgent(model: LanguageModelV2) {
  return new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model,
    tools: {
      myTool: {
        description: 'A test tool',
        parameters: { type: 'object', properties: { x: { type: 'number' } } } as any,
        execute: async ({ x }: any) => `result-${x}`,
      },
    },
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('DurableAgent onIterationComplete callback', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stops the loop when callback returns { continue: false } (Bug 15)', async () => {
    const model = makeNeverStoppingModel();
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    const onIterationComplete = vi.fn(() => ({ continue: false as const }));

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    // The callback should stop the loop after iteration 1
    expect(onIterationComplete).toHaveBeenCalledTimes(1);

    // Only 1 tool-call should have happened (loop stopped after first iteration)
    const toolCallChunks = chunks.filter((c: any) => c?.type === 'tool-call');
    expect(toolCallChunks.length).toBe(1);

    cleanup();
  });

  it('forces the loop to continue when callback returns { continue: true } (Bug 15)', async () => {
    // Model stops naturally after 1 tool call (finishReason: stop on call 2)
    const model = makeToolCallingModel(1);
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    let iteration = 0;
    const onIterationComplete = vi.fn(() => {
      iteration++;
      if (iteration <= 2) {
        // Force continue for 2 extra iterations
        return { continue: true as const };
      }
      return { continue: false as const };
    });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    // The callback forced extra iterations beyond the model's natural stop
    expect(onIterationComplete).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('two-phase stop: { continue: false, feedback } allows one more turn then stops (Bug 13)', async () => {
    const model = makeNeverStoppingModel();
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    let iteration = 0;
    const onIterationComplete = vi.fn(() => {
      iteration++;
      if (iteration === 1) {
        // First iteration: request one more turn with feedback, then stop
        return {
          continue: false as const,
          feedback: 'Please provide a summary before stopping.',
        };
      }
      // Should not be called more than twice
      return undefined;
    });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    // Two iterations: iteration 1 triggers feedback+stop, iteration 2 runs the
    // feedback turn and then the pendingFeedbackStop kicks in
    expect(onIterationComplete).toHaveBeenCalledTimes(2);

    // Should have had 2 tool-call chunks (one per iteration)
    const toolCallChunks = chunks.filter((c: any) => c?.type === 'tool-call');
    expect(toolCallChunks.length).toBe(2);

    cleanup();
  });

  it('{ feedback } without continue injects feedback and continues (Bug 13)', async () => {
    const model = makeToolCallingModel(2);
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    let iteration = 0;
    const onIterationComplete = vi.fn(() => {
      iteration++;
      if (iteration === 1) {
        // Inject feedback but don't stop — let the loop continue naturally
        return { feedback: 'Keep going, you are doing great!' };
      }
      return undefined;
    });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    // The model calls the tool 2 times then stops naturally (3 iterations total)
    expect(onIterationComplete.mock.calls.length).toBeGreaterThanOrEqual(2);

    cleanup();
  });

  it('receives correct iteration context', async () => {
    const model = makeToolCallingModel(1);
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    const contexts: any[] = [];
    const onIterationComplete = vi.fn((ctx: any) => {
      contexts.push(ctx);
      return undefined;
    });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    for await (const _ of fullStream) {
      // drain
    }

    // At least 1 iteration should have context
    expect(contexts.length).toBeGreaterThanOrEqual(1);

    const first = contexts[0]!;
    expect(first.iteration).toBe(1);
    expect(first.maxIterations).toBe(10);
    expect(first.runId).toBeTruthy();
    expect(first.agentId).toBe('test-agent');
    expect(first.agentName).toBe('test-agent');
    expect(typeof first.isFinal).toBe('boolean');
    expect(typeof first.finishReason).toBe('string');
    // Messages should be an array (may be empty if no memory configured)
    expect(Array.isArray(first.messages)).toBe(true);

    cleanup();
  });

  it('errors in onIterationComplete do not crash the loop', async () => {
    const model = makeToolCallingModel(1);
    const agent = makeAgent(model as LanguageModelV2);
    const durableAgent = createDurableAgent({ agent, pubsub });

    const onIterationComplete = vi.fn(() => {
      throw new Error('callback boom');
    });

    const { fullStream, cleanup } = await durableAgent.stream('Go', {
      maxSteps: 10,
      onIterationComplete,
    });

    // Should not throw — error is caught and logged
    const chunks: unknown[] = [];
    for await (const chunk of fullStream) {
      chunks.push(chunk);
    }

    expect(onIterationComplete).toHaveBeenCalled();
    // The loop should have completed despite the error
    expect(chunks.length).toBeGreaterThan(0);

    cleanup();
  });
});
