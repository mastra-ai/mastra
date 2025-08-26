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

  describe('Penalty Configuration Tests', () => {
    it('should create scorer with custom penalty configurations', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Sample context'],
          penalties: {
            unusedHighRelevanceContext: 0.2, // Double the default
            missingContextPerItem: 0.1, // Lower than default
            maxMissingContextPenalty: 0.4, // Lower than default
          },
        },
      });

      expect(scorer.name).toBe('Context Relevance (LLM)');
      expect(scorer.description).toContain('Evaluates how relevant and useful the provided context was');
    });

    it('should create scorer with partial penalty configurations', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Sample context'],
          penalties: {
            unusedHighRelevanceContext: 0.05, // Only override this one
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should use default penalty values when none are specified', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Test context'],
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should accept custom unused high-relevance context penalty', () => {
      const customPenalty = 0.25; // Higher than default 0.1
      
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Test context'],
          penalties: {
            unusedHighRelevanceContext: customPenalty,
          },
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should accept custom missing context penalty configuration', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Test context'],
          penalties: {
            missingContextPerItem: 0.1, // Lower than default 0.15
            maxMissingContextPenalty: 0.3, // Lower than default 0.5
          },
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should accept all penalty configurations together', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Test context'],
          penalties: {
            unusedHighRelevanceContext: 0.2,
            missingContextPerItem: 0.1,
            maxMissingContextPenalty: 0.4,
          },
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Context Relevance (LLM)');
    });

    it('should handle edge case penalty values', () => {
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          context: ['Test context'],
          penalties: {
            unusedHighRelevanceContext: 0, // No penalty
            missingContextPerItem: 0.5, // High penalty per item
            maxMissingContextPenalty: 1.0, // Maximum possible penalty
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should work with contextExtractor and custom penalties', () => {
      const contextExtractor = () => ['Dynamic context'];
      
      const scorer = createContextRelevanceScorerLLM({
        model: mockModel,
        options: {
          contextExtractor,
          penalties: {
            unusedHighRelevanceContext: 0.15,
            missingContextPerItem: 0.2,
          },
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Context Relevance (LLM)');
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
      await expect(scorer.run(testRun)).resolves.not.toThrow();
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
      await expect(scorer.run(testRun)).resolves.not.toThrow();
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
