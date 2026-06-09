/**
 * Reproduction test for mc "send message does nothing" bug.
 * Tests the complete flow: dynamic model + harness + evented workflow engine.
 *
 * Root cause: PR #17534 (e9cf1743) removed currentModelId/modeId from the state
 * schema, so Zod stripped them during setState — getDynamicModel then threw
 * "No model selected" which was silently swallowed by the idle-start .catch()
 * in thread-stream-runtime.ts.
 *
 * Fix 1 (PR #17676): Restored currentModelId/modeId to stateSchema.
 * Fix 2 (this PR): Propagate idle-start errors to the subscription stream via
 *         the new `run-failed` event so the harness surfaces an error event.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import type { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

describe('mc send-message reproduction', () => {
  it('produces assistant response with dynamic model + init + startWorkers', async () => {
    const storage = new InMemoryStore();

    function getDynamicModel({ requestContext }: { requestContext: RequestContext }) {
      const harnessContext = requestContext.get('harness') as any;
      const modelId = harnessContext?.state?.currentModelId;
      if (!modelId) {
        throw new Error('No model selected');
      }
      return createTextStreamModel('Hello from the agent!');
    }

    const stateSchema = z.object({
      currentModelId: z.string().optional(),
      modeId: z.string().optional(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: getDynamicModel as any,
      instructions: 'You are a test agent.',
    });

    const harness = new Harness({
      id: 'test-harness',
      storage,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
      defaultModeId: 'build',
      stateSchema,
    });

    await harness.init();
    await harness.getMastra()?.startWorkers();
    await harness.createThread();

    const events: HarnessEvent[] = [];
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
    });

    expect((harness.getState() as any).currentModelId).toBe('anthropic/claude-opus-4-7');

    await harness.sendMessage({ content: 'Hello!' });

    const assistantEnd = events.find(
      (e): e is Extract<HarnessEvent, { type: 'message_end' }> =>
        e.type === 'message_end' && e.message.role === 'assistant',
    );
    expect(assistantEnd).toBeDefined();
    expect(assistantEnd!.message.content).toEqual([{ type: 'text', text: 'Hello from the agent!' }]);
  }, 30000);

  it('surfaces error event when model function throws during idle-start', async () => {
    const storage = new InMemoryStore();

    function throwingModel() {
      throw new Error('No model selected');
    }

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: throwingModel as any,
      instructions: 'You are a test agent.',
    });

    const harness = new Harness({
      id: 'test-harness',
      storage,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent, defaultModelId: 'mock-model' }],
      defaultModeId: 'build',
    });

    await harness.init();
    await harness.getMastra()?.startWorkers();
    await harness.createThread();

    const events: HarnessEvent[] = [];
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
    });

    await harness.sendMessage({ content: 'Hello!' });

    // With the fix, the error should propagate through the subscription stream
    // and the harness should emit an error event instead of silently completing
    const errorEvent = events.find(
      (e): e is Extract<HarnessEvent, { type: 'error' }> => e.type === 'error',
    );
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error.message).toContain('No model selected');
  }, 30000);
});
