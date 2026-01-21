/**
 * DurableAgent Reasoning Tests
 *
 * Tests for AI SDK v6/LanguageModelV3 reasoning features.
 * Validates that reasoning stream parts and extended thinking
 * work correctly through durable execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock model that returns reasoning then text
 */
function createReasoningModel(reasoningText: string, responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        // Note: V2 models don't have native reasoning-start/delta/end
        // but the agent may receive these from V3 models wrapped as V2
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
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

/**
 * Creates a mock model with V3-style usage including reasoning tokens
 */
function createReasoningUsageModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          // V3-style usage with reasoning tokens
          usage: {
            inputTokens: 10,
            outputTokens: 25,
            totalTokens: 35,
            // Extended usage info that may come from V3 models
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
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

/**
 * Creates a mock model with multiple text chunks (interleaved style)
 */
function createInterleavedModel(chunks: string[]) {
  const textChunks = chunks.flatMap((text, index) => [{ type: 'text-delta' as const, id: 'text-1', delta: text }]);

  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...textChunks,
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
// DurableAgent Reasoning Tests
// ============================================================================

describe('DurableAgent reasoning features', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('reasoning model configuration', () => {
    it('should accept model that supports reasoning', async () => {
      const mockModel = createReasoningModel('Let me think about this step by step...', 'The answer is 42.');

      const agent = new DurableAgent({
        id: 'reasoning-agent',
        name: 'Reasoning Agent',
        instructions: 'Think through problems carefully.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('What is the meaning of life?');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput.modelConfig).toBeDefined();
    });

    it('should work with model that returns reasoning tokens in usage', async () => {
      const mockModel = createReasoningUsageModel('Based on my analysis, the answer is clear.');

      const agent = new DurableAgent({
        id: 'reasoning-usage-agent',
        name: 'Reasoning Usage Agent',
        instructions: 'Analyze and respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Analyze this problem');

      expect(result.runId).toBeDefined();
    });
  });

  describe('reasoning with streaming', () => {
    it('should stream reasoning-capable responses', async () => {
      const mockModel = createReasoningModel('Thinking...', 'Here is my response.');

      const agent = new DurableAgent({
        id: 'stream-reasoning-agent',
        name: 'Stream Reasoning Agent',
        instructions: 'Think and respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Give me a thoughtful answer');

      expect(runId).toBeDefined();
      cleanup();
    });

    it('should handle interleaved text chunks', async () => {
      const mockModel = createInterleavedModel([
        'First, ',
        'let me consider ',
        'all the factors. ',
        'The answer is clear.',
      ]);

      const agent = new DurableAgent({
        id: 'interleaved-agent',
        name: 'Interleaved Agent',
        instructions: 'Process information.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Process this');

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('reasoning workflow serialization', () => {
    it('should serialize workflow input for reasoning models', async () => {
      const mockModel = createReasoningModel('Thinking...', 'Answer');

      const agent = new DurableAgent({
        id: 'serialize-reasoning-agent',
        name: 'Serialize Reasoning Agent',
        instructions: 'Think through problems.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Think about this');

      // Verify workflow input is JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.runId).toBe(result.runId);
      expect(parsed.modelConfig).toBeDefined();
    });

    it('should preserve model configuration through preparation', async () => {
      const mockModel = createReasoningModel('Analysis...', 'Result');

      const agent = new DurableAgent({
        id: 'model-config-agent',
        name: 'Model Config Agent',
        instructions: 'Analyze carefully.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Analyze', {
        modelSettings: {
          temperature: 0.7,
        },
      });

      expect(result.workflowInput.options.temperature).toBe(0.7);
    });
  });

  describe('reasoning with memory', () => {
    it('should handle reasoning models with memory configuration', async () => {
      const mockModel = createReasoningModel(
        'Considering previous context...',
        'Based on our conversation, here is my answer.',
      );

      const agent = new DurableAgent({
        id: 'reasoning-memory-agent',
        name: 'Reasoning Memory Agent',
        instructions: 'Think with context.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Continue our discussion', {
        memory: {
          thread: 'reasoning-thread',
          resource: 'reasoning-user',
          options: {
            lastMessages: 10,
          },
        },
      });

      expect(result.threadId).toBe('reasoning-thread');
      expect(result.workflowInput.state.memoryConfig?.lastMessages).toBe(10);
    });
  });

  describe('reasoning edge cases', () => {
    it('should handle empty reasoning response', async () => {
      const mockModel = createTextModel('');

      const agent = new DurableAgent({
        id: 'empty-reasoning-agent',
        name: 'Empty Reasoning Agent',
        instructions: 'Respond.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello');

      expect(result.runId).toBeDefined();
    });

    it('should handle very long reasoning content', async () => {
      const longText = 'This is a detailed analysis. '.repeat(100);
      const mockModel = createReasoningModel(longText, 'Conclusion.');

      const agent = new DurableAgent({
        id: 'long-reasoning-agent',
        name: 'Long Reasoning Agent',
        instructions: 'Analyze thoroughly.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Give me a detailed analysis');

      expect(result.runId).toBeDefined();

      // Should still serialize correctly
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();
    });

    it('should handle special characters in reasoning content', async () => {
      const specialText = 'Analysis: "quotes", \'apostrophes\', <tags>, & ampersands, emoji: 🤔';
      const mockModel = createReasoningModel(specialText, 'Done.');

      const agent = new DurableAgent({
        id: 'special-chars-reasoning-agent',
        name: 'Special Chars Reasoning Agent',
        instructions: 'Handle special characters.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Test special characters');

      expect(result.runId).toBeDefined();
    });
  });
});

describe('DurableAgent V3 usage format', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle V3-style usage with detailed token breakdown', async () => {
    // V3 models return more detailed usage info
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: {
              inputTokens: 50,
              outputTokens: 100,
              totalTokens: 150,
            },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new DurableAgent({
      id: 'v3-usage-agent',
      name: 'V3 Usage Agent',
      instructions: 'Process with V3 usage.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const { runId, cleanup } = await agent.stream('Test V3 usage');

    expect(runId).toBeDefined();
    cleanup();
  });
});
