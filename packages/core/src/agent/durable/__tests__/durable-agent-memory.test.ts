/**
 * DurableAgent Memory Tests
 *
 * Durable-only memory internals: prepare()-time thread normalization, memory config
 * serialization into workflow state, and title-generation lifecycle ordering.
 * User-visible memory behavior lives in the aimock loop scenarios
 * (src/loop/test-utils/aimock/scenarios/memory-*.scenario.test.ts).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor } from '../../../processors';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Memory Tests
// ============================================================================

describe('DurableAgent memory configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('basic memory options', () => {
    it('should handle memory.thread as object with id', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'thread-object-agent',
        name: 'Thread Object Agent',
        instructions: 'Test thread object',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        memory: {
          thread: { id: 'thread-from-object' },
          resource: 'user-456',
        },
      });

      expect(result.threadId).toBe('thread-from-object');
      expect(result.resourceId).toBe('user-456');
    });

    it('should apply processInputStep model overrides before model execution', async () => {
      let originalModelCalls = 0;
      let overrideModelCalls = 0;
      const createTrackingTextModel = (text: string, onStream: () => void) =>
        new MockLanguageModelV2({
          doStream: async () => {
            onStream();
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: text },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
        });

      const modelOverrideProcessor: InputProcessor = {
        id: 'model-override-processor',
        processInputStep: async () => ({
          model: createTrackingTextModel('processed response', () => overrideModelCalls++) as LanguageModelV2,
        }),
      };

      const baseAgent = new Agent({
        id: 'model-override-agent',
        name: 'Model Override Agent',
        instructions: 'Test processInputStep model override',
        model: createTrackingTextModel('original response', () => originalModelCalls++) as LanguageModelV2,
        inputProcessors: [modelOverrideProcessor],
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.stream('Hello');
      for await (const _chunk of result.fullStream as AsyncIterable<any>) {
      }

      expect(originalModelCalls).toBe(0);
      expect(overrideModelCalls).toBe(1);
    });
  });

  describe('memory.options configuration', () => {
    it('should include semanticRecall options in workflow state', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'semantic-agent',
        name: 'Semantic Agent',
        instructions: 'Test semantic recall',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        memory: {
          thread: 'thread-semantic',
          resource: 'user-semantic',
          options: {
            semanticRecall: {
              topK: 5,
              messageRange: { before: 2, after: 2 },
            },
          },
        },
      });

      expect(result.workflowInput.state.memoryConfig?.semanticRecall).toBeDefined();
      expect(result.workflowInput.state.memoryConfig?.semanticRecall?.topK).toBe(5);
    });
  });

  describe('memory serialization in workflow input', () => {
    it('should serialize memory config as JSON', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'serialization-agent',
        name: 'Serialization Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        memory: {
          thread: 'thread-serialize',
          resource: 'user-serialize',
          options: {
            lastMessages: 15,
            readOnly: true,
          },
        },
      });

      // Verify workflow input is JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.state.threadId).toBe('thread-serialize');
      expect(parsed.state.resourceId).toBe('user-serialize');
      expect(parsed.state.memoryConfig.lastMessages).toBe(15);
      expect(parsed.state.memoryConfig.readOnly).toBe(true);
    });

    it('should handle undefined memory config values', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'undefined-config-agent',
        name: 'Undefined Config Agent',
        instructions: 'Test undefined values',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.prepare('Hello', {
        memory: {
          thread: 'thread-undefined',
          resource: 'user-undefined',
          // options is undefined
        },
      });

      // Should still be serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.state.threadId).toBe('thread-undefined');
    });
  });
});

describe('DurableAgent memory edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle empty thread ID string', async () => {
    const mockModel = createTextModel('Hello!');

    const baseAgent = new Agent({
      id: 'empty-thread-agent',
      name: 'Empty Thread Agent',
      instructions: 'Test empty thread',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Hello', {
      memory: {
        thread: '',
        resource: 'user-empty-thread',
      },
    });

    expect(result.threadId).toBe('');
    expect(result.resourceId).toBe('user-empty-thread');
  });

  // Regression: the durable finish step never ported the non-durable `#executeOnFinish`
  // title-generation branch, so `memory.options.generateTitle` silently never fired for
  // durable/evented agents (and Inngest). See create-durable-agentic-workflow.ts.
  describe('generateTitle', () => {
    it('finishes the stream before lifecycle-managed title generation completes', async () => {
      const mockMemory = new MockMemory();
      mockMemory.getMergedThreadConfig = () => ({ generateTitle: true });

      const baseAgent = new Agent({
        id: 'title-durable-agent',
        name: 'Title Durable Agent',
        instructions: 'Test durable title generation',
        model: createTextModel('assistant response') as LanguageModelV2,
        memory: mockMemory,
      });
      let resolveTitle: (title: string) => void;
      const titlePending = new Promise<string>(resolve => {
        resolveTitle = resolve;
      });
      const generateTitle = vi.spyOn(baseAgent, 'genTitle').mockReturnValue(titlePending);
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const result = await durableAgent.stream('What is the weather like today?', {
        memory: { thread: 'thread-title', resource: 'resource-title' },
      });
      for await (const _chunk of result.fullStream as AsyncIterable<any>) {
      }

      expect(generateTitle).toHaveBeenCalledTimes(1);
      expect((await mockMemory.getThreadById({ threadId: 'thread-title' }))?.title).toBe('');

      resolveTitle!('Generated Thread Title');
      await vi.waitFor(async () => {
        const thread = await mockMemory.getThreadById({ threadId: 'thread-title' });
        expect(thread?.title).toBe('Generated Thread Title');
      });
      result.cleanup();
    });
  });
});
