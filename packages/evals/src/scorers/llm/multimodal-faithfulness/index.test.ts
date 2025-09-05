import { openai } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';
import { createMultimodalFaithfulnessScorer, DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS } from './index';

describe('MultimodalFaithfulnessScorer Configuration', () => {
  // Use a real AI SDK model for proper type compatibility
  const mockModel = openai('gpt-4-vision-preview');

  describe('createMultimodalFaithfulnessScorer', () => {
    it('should create a scorer with default options', () => {
      const scorer = createMultimodalFaithfulnessScorer({ model: mockModel });

      expect(scorer.name).toBe('Multimodal Faithfulness Scorer');
      expect(scorer.description).toContain('multimodal contexts');
    });

    it('should create a scorer with custom options', () => {
      const customOptions = {
        scale: 10,
        contexts: [
          { type: 'text' as const, content: 'Test context' },
          { type: 'image' as const, content: '[Image data]' },
        ],
      };

      const scorer = createMultimodalFaithfulnessScorer({
        model: mockModel,
        options: customOptions,
      });

      expect(scorer.name).toBe('Multimodal Faithfulness Scorer');
      expect(scorer.description).toContain('multimodal contexts');
    });

    it('should merge custom options with defaults', () => {
      const partialOptions = {
        scale: 5,
      };

      const scorer = createMultimodalFaithfulnessScorer({
        model: mockModel,
        options: partialOptions,
      });

      expect(scorer.name).toBe('Multimodal Faithfulness Scorer');
    });
  });

  describe('default options', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS.scale).toBe(1);
      expect(DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS.contexts).toEqual([]);
    });
  });

  describe('scorer interface', () => {
    it('should expose the correct properties', () => {
      const scorer = createMultimodalFaithfulnessScorer({ model: mockModel });

      expect(scorer.name).toBeTypeOf('string');
      expect(scorer.description).toBeTypeOf('string');
      expect(scorer.judge).toBeTypeOf('object');
      expect(typeof scorer.run).toBe('function');
      expect(typeof scorer.getSteps).toBe('function');
    });

    it('should have proper judge configuration', () => {
      const scorer = createMultimodalFaithfulnessScorer({ model: mockModel });

      expect(scorer.judge?.model).toBe(mockModel);
      expect(scorer.judge?.instructions).toContain('multimodal faithfulness evaluator');
    });
  });

  describe('context handling', () => {
    it('should accept various context types', () => {
      const contexts = [
        { type: 'text' as const, content: 'Text context' },
        { type: 'image' as const, content: '[Image data]' },
        { type: 'multimodal' as const, content: { text: 'Mixed', image: 'data' } },
      ];

      const scorer = createMultimodalFaithfulnessScorer({
        model: mockModel,
        options: { contexts },
      });

      expect(scorer).toBeDefined();
    });

    it('should handle empty contexts array', () => {
      const scorer = createMultimodalFaithfulnessScorer({
        model: mockModel,
        options: { contexts: [] },
      });

      expect(scorer).toBeDefined();
    });
  });

  describe('scoring configuration', () => {
    it('should support custom scale values', () => {
      const scales = [1, 5, 10, 100];

      scales.forEach(scale => {
        const scorer = createMultimodalFaithfulnessScorer({
          model: mockModel,
          options: { scale },
        });

        expect(scorer).toBeDefined();
      });
    });
  });
});
