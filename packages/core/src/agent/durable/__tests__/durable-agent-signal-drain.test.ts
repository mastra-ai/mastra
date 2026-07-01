/**
 * DurableAgent Signal Drain Tests
 *
 * Verifies that the durable agent correctly consumes signals at three points,
 * mirroring the regular agent's signal drain mechanism:
 *
 * Bug 5:  Inter-iteration signal drain — signals queued while the previous
 *         iteration was running are drained between iterations, forcing the
 *         loop to continue so the LLM sees them.
 * Bug 11: Initial signal echoes — signals that were part of the input messages
 *         are echoed to the client stream on the first model request.
 *
 * Also covers pre-run signal drain (signals queued before the first model
 * request).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import type { CreatedAgentSignal } from '../../signals';
import { createSignal } from '../../signals';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

let modelCallCount = 0;

/**
 * Model that calls a tool once then stops with text.
 * Two calls → two iterations, giving the predicate a chance to drain
 * signals between them.
 */
function makeToolThenStopModel() {
  modelCallCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      modelCallCount++;
      if (modelCallCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `resp-${modelCallCount}`, modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: `tc-${modelCallCount}`,
              toolName: 'myTool',
              input: JSON.stringify({ x: 1 }),
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
          { type: 'response-metadata', id: `resp-${modelCallCount}`, modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'final-text' },
          { type: 'text-delta', id: 'final-text', delta: 'Done with signals!' },
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
 * Model that just produces text and stops on every call.
 * Used for single-iteration tests (initial echoes, pre-run drain).
 */
function makeSimpleTextModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createTestSignal(
  text: string,
  overrides?: Partial<{ type: 'user' | 'state' | 'reactive' | 'notification' }>,
): CreatedAgentSignal {
  return createSignal({
    type: overrides?.type ?? 'user',
    contents: text,
    id: `sig-${text.replace(/\s+/g, '-').toLowerCase()}`,
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('DurableAgent signal drain', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    modelCallCount = 0;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await pubsub.close();
  });

  describe('initial signal echoes (Bug 11)', () => {
    it('echoes input signal messages to the client stream on the first model request', async () => {
      const agent = new Agent({
        id: 'signal-echo-agent',
        name: 'signal-echo-agent',
        instructions: 'You are helpful.',
        model: makeSimpleTextModel() as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent, pubsub });

      // Create signals that simulate what getInitialSignalEchoes would return
      // (signals already in the messageList with role 'signal' from persisted history)
      const echoSignals = [createTestSignal('echo one'), createTestSignal('echo two')];

      // Intercept the registry entry to inject initialSignalEchoes
      const originalGet = globalRunRegistry.get.bind(globalRunRegistry);
      let intercepted = false;
      vi.spyOn(globalRunRegistry, 'get').mockImplementation((runId: string) => {
        const entry = originalGet(runId);
        if (entry && !intercepted) {
          intercepted = true;
          entry.initialSignalEchoes = [...echoSignals];
        }
        return entry;
      });

      const { fullStream, cleanup } = await durableAgent.stream('Hello', { maxSteps: 3 });

      const chunks: any[] = [];
      for await (const chunk of fullStream) {
        chunks.push(chunk);
      }
      await cleanup?.();

      // Find the signal data parts in the stream — echoed signals should appear
      const signalChunks = chunks.filter((c: any) => c.type === 'data-signal' || c.type === 'data-user-message');

      expect(signalChunks.length).toBe(2);
      expect(signalChunks[0].data.contents).toBe('echo one');
      expect(signalChunks[1].data.contents).toBe('echo two');
    });
  });

  describe('pre-run signal drain', () => {
    it('drains pre-run signals queued before the first model request', async () => {
      const agent = new Agent({
        id: 'prerun-drain-agent',
        name: 'prerun-drain-agent',
        instructions: 'You are helpful.',
        model: makeSimpleTextModel() as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent, pubsub });

      // Pre-run signals: queue them via the registry entry's drainPendingSignals
      // by monkey-patching the registry entry after preparation
      const preRunSignals = [createTestSignal('prerun signal one'), createTestSignal('prerun signal two')];

      // We need to intercept the registry entry to inject pre-run signals
      const originalGet = globalRunRegistry.get.bind(globalRunRegistry);
      let intercepted = false;
      const getInterceptor = vi.fn((runId: string) => {
        const entry = originalGet(runId);
        if (entry && !intercepted) {
          intercepted = true;
          const originalDrain = entry.drainPendingSignals;
          let preRunDrained = false;
          entry.drainPendingSignals = (scope?: 'pending' | 'pre-run') => {
            if (scope === 'pre-run' && !preRunDrained) {
              preRunDrained = true;
              return preRunSignals;
            }
            return originalDrain?.(scope) ?? [];
          };
        }
        return entry;
      });
      vi.spyOn(globalRunRegistry, 'get').mockImplementation(getInterceptor);

      const { fullStream, cleanup } = await durableAgent.stream('Hello', { maxSteps: 3 });

      const chunks: any[] = [];
      for await (const chunk of fullStream) {
        chunks.push(chunk);
      }
      await cleanup?.();

      // Find the signal data parts in the stream
      const signalChunks = chunks.filter((c: any) => c.type === 'data-signal' || c.type === 'data-user-message');

      // Pre-run signals should appear in the stream
      expect(signalChunks.length).toBe(2);
      expect(signalChunks[0].data.contents).toBe('prerun signal one');
      expect(signalChunks[1].data.contents).toBe('prerun signal two');
    });
  });

  describe('inter-iteration signal drain (Bug 5)', () => {
    it('drains pending signals between iterations and forces continuation', async () => {
      const myTool = {
        description: 'A tool',
        parameters: z.object({ x: z.number() }),
        execute: async ({ x }: { x: number }) => `result-${x}`,
      };

      const agent = new Agent({
        id: 'inter-iter-drain-agent',
        name: 'inter-iter-drain-agent',
        instructions: 'You are helpful.',
        model: makeToolThenStopModel() as LanguageModelV2,
        tools: { myTool },
      });

      const durableAgent = createDurableAgent({ agent, pubsub });

      // We need signals to be available when drained between iterations.
      // We'll inject them via the registry entry after the first iteration.
      const pendingSignals = [createTestSignal('inter-iter signal')];

      const originalGet = globalRunRegistry.get.bind(globalRunRegistry);
      let drainCallCount = 0;
      vi.spyOn(globalRunRegistry, 'get').mockImplementation((runId: string) => {
        const entry = originalGet(runId);
        if (entry) {
          const originalDrain = entry.drainPendingSignals;
          entry.drainPendingSignals = (scope?: 'pending' | 'pre-run') => {
            if (scope === 'pending') {
              drainCallCount++;
              // Return signals on the first pending drain (within-iteration
              // signal-drain step runs first, then predicate). We fire on the
              // first drain call so the signal is consumed in one of the two
              // drain sites.
              if (drainCallCount === 1) {
                return pendingSignals;
              }
            }
            return originalDrain?.(scope) ?? [];
          };
        }
        return entry;
      });

      const { fullStream, cleanup } = await durableAgent.stream('Hello', { maxSteps: 5 });

      const chunks: any[] = [];
      for await (const chunk of fullStream) {
        chunks.push(chunk);
      }
      await cleanup?.();

      // Find the signal data parts in the stream
      const signalChunks = chunks.filter((c: any) => c.type === 'data-signal' || c.type === 'data-user-message');

      // The inter-iteration signal should appear in the stream
      expect(signalChunks.length).toBe(1);
      expect(signalChunks[0].data.contents).toBe('inter-iter signal');

      // The drain function should have been called at least once
      expect(drainCallCount).toBeGreaterThanOrEqual(1);
    });

    it('forces loop continuation when signals are drained even if LLM would have stopped', async () => {
      // Model always produces text (no tool calls) → normally single iteration
      let callNum = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          callNum++;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `resp-${callNum}`, modelId: 'mock-model', timestamp: new Date(0) },
              { type: 'text-start', id: `text-${callNum}` },
              { type: 'text-delta', id: `text-${callNum}`, delta: `Response ${callNum}` },
              { type: 'text-end', id: `text-${callNum}` },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const agent = new Agent({
        id: 'force-continue-agent',
        name: 'force-continue-agent',
        instructions: 'You are helpful.',
        model: model as LanguageModelV2,
      });

      const durableAgent = createDurableAgent({ agent, pubsub });

      // Inject a pending signal after the first iteration — this should force
      // the loop to continue even though the model said "stop".
      const pendingSignals = [createTestSignal('forced continuation signal')];
      const originalGet = globalRunRegistry.get.bind(globalRunRegistry);
      let pendingDrainCount = 0;
      vi.spyOn(globalRunRegistry, 'get').mockImplementation((runId: string) => {
        const entry = originalGet(runId);
        if (entry) {
          const originalDrain = entry.drainPendingSignals;
          entry.drainPendingSignals = (scope?: 'pending' | 'pre-run') => {
            if (scope === 'pending') {
              pendingDrainCount++;
              // Return signal on the first pending drain only
              if (pendingDrainCount === 1) {
                return pendingSignals;
              }
            }
            return originalDrain?.(scope) ?? [];
          };
        }
        return entry;
      });

      const { fullStream, cleanup } = await durableAgent.stream('Hello', { maxSteps: 5 });

      const chunks: any[] = [];
      for await (const chunk of fullStream) {
        chunks.push(chunk);
      }
      await cleanup?.();

      // The model should have been called at least twice because the signal
      // forced continuation after the first "stop" response.
      expect(callNum).toBeGreaterThanOrEqual(2);

      // The signal should appear in the stream
      const signalChunks = chunks.filter((c: any) => c.type === 'data-signal' || c.type === 'data-user-message');
      expect(signalChunks.length).toBe(1);
      expect(signalChunks[0].data.contents).toBe('forced continuation signal');
    });
  });
});
