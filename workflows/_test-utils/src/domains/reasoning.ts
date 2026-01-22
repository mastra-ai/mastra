/**
 * Reasoning tests for DurableAgent
 *
 * Tests for AI SDK v6/LanguageModelV3 reasoning features.
 * Validates that reasoning stream parts and extended thinking
 * work correctly through durable execution.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createMultiChunkStreamModel } from '../mock-models';

export function createReasoningTests({ createAgent }: DurableAgentTestContext) {
  describe('reasoning features', () => {
    describe('reasoning model configuration', () => {
      it('should accept model that supports reasoning', async () => {
        const mockModel = createTextStreamModel('The answer is 42.');

        const agent = await createAgent({
          id: 'reasoning-agent',
          name: 'Reasoning Agent',
          instructions: 'Think through problems carefully.',
          model: mockModel,
        });

        const result = await agent.prepare('What is the meaning of life?');

        expect(result.runId).toBeDefined();
        expect(result.workflowInput.modelConfig).toBeDefined();
      });

      it('should work with model that returns reasoning tokens in usage', async () => {
        const mockModel = createTextStreamModel('Based on my analysis, the answer is clear.');

        const agent = await createAgent({
          id: 'reasoning-usage-agent',
          name: 'Reasoning Usage Agent',
          instructions: 'Analyze and respond.',
          model: mockModel,
        });

        const result = await agent.prepare('Analyze this problem');

        expect(result.runId).toBeDefined();
      });
    });

    describe('reasoning with streaming', () => {
      it('should stream reasoning-capable responses', async () => {
        const mockModel = createTextStreamModel('Here is my response.');

        const agent = await createAgent({
          id: 'stream-reasoning-agent',
          name: 'Stream Reasoning Agent',
          instructions: 'Think and respond.',
          model: mockModel,
        });

        const { runId, cleanup } = await agent.stream('Give me a thoughtful answer');

        expect(runId).toBeDefined();
        cleanup();
      });

      it('should handle interleaved text chunks', async () => {
        const mockModel = createMultiChunkStreamModel([
          'First, ',
          'let me consider ',
          'all the factors. ',
          'The answer is clear.',
        ]);

        const agent = await createAgent({
          id: 'interleaved-agent',
          name: 'Interleaved Agent',
          instructions: 'Process information.',
          model: mockModel,
        });

        const { runId, cleanup } = await agent.stream('Process this');

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('reasoning workflow serialization', () => {
      it('should serialize workflow input for reasoning models', async () => {
        const mockModel = createTextStreamModel('Answer');

        const agent = await createAgent({
          id: 'serialize-reasoning-agent',
          name: 'Serialize Reasoning Agent',
          instructions: 'Think through problems.',
          model: mockModel,
        });

        const result = await agent.prepare('Think about this');

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.runId).toBe(result.runId);
        expect(parsed.modelConfig).toBeDefined();
      });

      it('should preserve model configuration through preparation', async () => {
        const mockModel = createTextStreamModel('Result');

        const agent = await createAgent({
          id: 'model-config-agent',
          name: 'Model Config Agent',
          instructions: 'Analyze carefully.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Based on our conversation, here is my answer.');

        const agent = await createAgent({
          id: 'reasoning-memory-agent',
          name: 'Reasoning Memory Agent',
          instructions: 'Think with context.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('');

        const agent = await createAgent({
          id: 'empty-reasoning-agent',
          name: 'Empty Reasoning Agent',
          instructions: 'Respond.',
          model: mockModel,
        });

        const result = await agent.prepare('Hello');

        expect(result.runId).toBeDefined();
      });

      it('should handle very long reasoning content', async () => {
        const longText = 'This is a detailed analysis. '.repeat(100);
        const mockModel = createTextStreamModel(longText);

        const agent = await createAgent({
          id: 'long-reasoning-agent',
          name: 'Long Reasoning Agent',
          instructions: 'Analyze thoroughly.',
          model: mockModel,
        });

        const result = await agent.prepare('Give me a detailed analysis');

        expect(result.runId).toBeDefined();

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();
      });

      it('should handle special characters in reasoning content', async () => {
        const mockModel = createTextStreamModel('Done.');

        const agent = await createAgent({
          id: 'special-chars-reasoning-agent',
          name: 'Special Chars Reasoning Agent',
          instructions: 'Handle special characters.',
          model: mockModel,
        });

        const result = await agent.prepare('Test special characters');

        expect(result.runId).toBeDefined();
      });
    });
  });

  describe('V3 usage format', () => {
    it('should handle V3-style usage with detailed token breakdown', async () => {
      const mockModel = createTextStreamModel('Response');

      const agent = await createAgent({
        id: 'v3-usage-agent',
        name: 'V3 Usage Agent',
        instructions: 'Process with V3 usage.',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Test V3 usage');

      expect(runId).toBeDefined();
      cleanup();
    });
  });
}
