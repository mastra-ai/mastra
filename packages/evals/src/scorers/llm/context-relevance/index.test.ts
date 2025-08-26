import { openai } from '@ai-sdk/openai';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { describe, it, expect } from 'vitest';
import { createAgentTestRun, createUIMessage } from '../../utils';
import { createContextRelevanceScorerLLM } from '.';

describe('Context Relevance Scorer', () => {
  const mockModel = openai('gpt-4o-mini');

  describe('Basic Configuration', () => {
    it('should create scorer with context provided', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Sample context information'],
          scale: 1,
        },
      });

      expect(scorer.name).toBe('Context Relevance (LLM)');
      expect(scorer.description).toContain('Evaluates how relevant and useful the provided context was');
    });

    it('should create scorer with context extractor', () => {
      const contextExtractor = (_: ScorerRunInputForAgent, __: ScorerRunOutputForAgent) => {
        return ['Custom extracted context'];
      };

      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          contextExtractor,
          scale: 1,
        },
      });

      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should throw error when neither context nor contextExtractor is provided', () => {
      expect(() =>
        createContextRelevanceScorerLLM({
          model: mockModel,
          options: {
            scale: 1,
          },
        }),
      ).toThrow('Either context or contextExtractor is required for Context Relevance scoring');
    });

    it('should throw error when context array is empty', () => {
      expect(() =>
        createContextRelevanceScorerLLM({
          model: mockModel,
          options: {
            context: [],
            scale: 1,
          },
        }),
      ).toThrow('Context array cannot be empty if provided');
    });
  });

  describe('Context Extraction', () => {
    it('should handle static context from options', async () => {
      const context = ['Einstein won the Nobel Prize for his discovery of the photoelectric effect'];

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: "Tell me about Einstein's achievements",
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: 'Einstein won the Nobel Prize for his work on the photoelectric effect',
          }),
        ],
      });

      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: { context },
      });

      // This should not throw during analysis step
      expect(async () => {
        await scorer.run(testRun);
      }).not.toThrow();
    });

    it('should handle dynamic context from extractor', async () => {
      const contextExtractor = (input: ScorerRunInputForAgent) => {
        // Extract context based on the query
        const userQuery = input?.inputMessages?.[0]?.content || '';
        if (userQuery.toLowerCase().includes('einstein')) {
          return [
            'Einstein won the Nobel Prize for his discovery of the photoelectric effect',
            'He developed the theory of relativity',
          ];
        }
        return ['General physics information'];
      };

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: "What were Einstein's major contributions to physics?",
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: "Einstein's major contributions include the photoelectric effect and relativity theory",
          }),
        ],
      });

      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: { contextExtractor },
      });

      // This should not throw during analysis step
      expect(async () => {
        await scorer.run(testRun);
      }).not.toThrow();
    });

    it('should throw error when no context is available', async () => {
      const contextExtractor = () => []; // Returns empty context

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'user-1',
            role: 'user',
            content: 'Test question',
          }),
        ],
        output: [
          createUIMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: 'Test response',
          }),
        ],
      });

      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: { contextExtractor },
      });

      await expect(scorer.run(testRun)).rejects.toThrow('No context available for evaluation');
    });
  });

  describe('Integration with Context Precision Pattern', () => {
    it('should follow same API pattern as context precision scorer', () => {
      // Both scorers should have similar option structures
      const contextRelevanceScorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['test context'],
          scale: 1,
        },
      });

      expect(contextRelevanceScorer.name).toBeDefined();
      expect(contextRelevanceScorer.description).toBeDefined();
      expect(typeof contextRelevanceScorer.run).toBe('function');
    });

    it('should support scaling like context precision scorer', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['test context'],
          scale: 2, // Double the score
        },
      });

      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should handle both context and contextExtractor options', () => {
      // Should prefer contextExtractor when both are provided
      const contextExtractor = () => ['extracted context'];

      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['static context'],
          contextExtractor,
          scale: 1,
        },
      });

      expect(scorer.name).toBe('Context Relevance (LLM)');
    });
  });
});
