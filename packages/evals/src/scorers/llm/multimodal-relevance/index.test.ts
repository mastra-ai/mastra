import { openai } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';
import { createMultimodalRelevanceScorer, DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS } from './index';

describe('MultimodalRelevanceScorer Configuration', () => {
  // Use a real AI SDK model for proper type compatibility
  const mockModel = openai('gpt-4-vision-preview');

  describe('createMultimodalRelevanceScorer', () => {
    it('should create a scorer with default options', () => {
      const scorer = createMultimodalRelevanceScorer({ model: mockModel });

      expect(scorer.name).toBe('Multimodal Relevance Scorer');
      expect(scorer.description).toContain('multimodal contexts');
    });

    it('should create a scorer with custom options', () => {
      const customOptions = {
        contextualGroundingWeight: 0.5,
        multimodalAlignmentWeight: 0.3,
        queryAlignmentWeight: 0.2,
        scale: 10,
      };

      const scorer = createMultimodalRelevanceScorer({
        model: mockModel,
        options: customOptions,
      });

      expect(scorer.name).toBe('Multimodal Relevance Scorer');
      expect(scorer.description).toContain('multimodal contexts');
    });

    it('should merge custom options with defaults', () => {
      const partialOptions = {
        scale: 5,
      };

      const scorer = createMultimodalRelevanceScorer({
        model: mockModel,
        options: partialOptions,
      });

      expect(scorer.name).toBe('Multimodal Relevance Scorer');
    });
  });

  describe('default options', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS.contextualGroundingWeight).toBe(0.4);
      expect(DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS.multimodalAlignmentWeight).toBe(0.3);
      expect(DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS.queryAlignmentWeight).toBe(0.3);
      expect(DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS.scale).toBe(1);
    });

    it('should sum weights to 1.0', () => {
      const { contextualGroundingWeight, multimodalAlignmentWeight, queryAlignmentWeight } =
        DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS;

      expect(contextualGroundingWeight + multimodalAlignmentWeight + queryAlignmentWeight).toBe(1.0);
    });
  });

  describe('scorer interface', () => {
    it('should expose the correct properties', () => {
      const scorer = createMultimodalRelevanceScorer({ model: mockModel });

      expect(scorer.name).toBeTypeOf('string');
      expect(scorer.description).toBeTypeOf('string');
      expect(scorer.judge).toBeTypeOf('object');
      expect(typeof scorer.run).toBe('function');
      expect(typeof scorer.getSteps).toBe('function');
    });

    it('should have proper judge configuration', () => {
      const scorer = createMultimodalRelevanceScorer({ model: mockModel });

      expect(scorer.judge?.model).toBe(mockModel);
      expect(scorer.judge?.instructions).toContain('multimodal relevance evaluator');
    });
  });
});
