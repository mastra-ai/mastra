import type { Evaluator, EvaluationResult, Metric } from '@mastra/core/eval';
import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEvaluatorsHandler, executeEvaluatorHandler } from './evaluators';

describe('Evaluators Handlers', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    mastra = new Mastra();

    // Mock the getEvaluators method with type assertion
    mastra.getEvaluators = vi.fn().mockReturnValue({
      hallucination: {
        name: 'Hallucination Evaluator',
        score: vi.fn().mockResolvedValue({ score: 0.8, info: { reason: 'Test reason' } }),
      } as unknown as Evaluator,
      'context-precision': {
        name: 'Context Precision Evaluator',
        score: vi.fn().mockResolvedValue({ score: 0.7, info: { reason: 'Test reason' } }),
      } as unknown as Evaluator,
      'answer-relevance': {
        name: 'Answer Relevance Evaluator',
        score: vi.fn().mockResolvedValue({ score: 0.9, info: { reason: 'Test reason' } }),
      } as unknown as Evaluator,
      'custom-metric': {
        name: 'Custom Metric',
        measure: vi.fn().mockResolvedValue({ score: 0.85, info: { details: 'Test details' } }),
      } as unknown as Metric,
    });
  });

  describe('getEvaluatorsHandler', () => {
    it('should return all evaluators successfully', async () => {
      const result = await getEvaluatorsHandler({ mastra });

      expect(Object.keys(result)).toEqual(['hallucination', 'context-precision', 'answer-relevance', 'custom-metric']);
      expect(Object.keys(result).length).toEqual(4);
      expect(mastra.getEvaluators).toHaveBeenCalled();
    });

    it('should handle errors when getting evaluators', async () => {
      const errorMessage = 'Failed to get evaluators';
      mastra.getEvaluators = vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      });

      try {
        await getEvaluatorsHandler({ mastra });
      } catch (error) {
        expect(error.message).toEqual(errorMessage);
      }
    });
  });

  describe('executeEvaluatorHandler', () => {
    it('should execute an evaluator successfully', async () => {
      const evaluatorId = 'hallucination';
      const input = 'Test input';
      const output = 'Test output';
      const options = { test: 'option' };

      const expectedResult = { score: 0.8, info: { reason: 'Test reason' } };

      const result = await executeEvaluatorHandler({
        mastra,
        evaluatorId,
        input,
        output,
        options,
      });

      expect(result).toEqual(expectedResult);

      const evaluators = mastra.getEvaluators();
      expect((evaluators[evaluatorId] as Evaluator).score).toHaveBeenCalledWith({ input, output, options });
    });

    it('should execute a metric successfully', async () => {
      const evaluatorId = 'custom-metric';
      const input = 'Test input';
      const output = 'Test output';

      const expectedResult = { score: 0.85, info: { details: 'Test details' } };

      const result = await executeEvaluatorHandler({
        mastra,
        evaluatorId,
        input,
        output,
      });

      expect(result).toEqual(expectedResult);

      const evaluators = mastra.getEvaluators();
      expect((evaluators[evaluatorId] as Metric).measure).toHaveBeenCalledWith(input, output);
    });

    it('should return 404 when evaluator is not found', async () => {
      const evaluatorId = 'non-existent';
      const input = 'Test input';
      const output = 'Test output';

      const result = await executeEvaluatorHandler({
        mastra,
        evaluatorId,
        input,
        output,
      });

      expect(result).toEqual({
        status: 404,
        message: `Evaluator with ID "${evaluatorId}" not found`,
      });
    });

    it('should handle errors when executing evaluator', async () => {
      const evaluatorId = 'hallucination';
      const input = 'Test input';
      const output = 'Test output';

      const errorMessage = 'Failed to execute evaluator';
      const evaluators = mastra.getEvaluators();
      (evaluators[evaluatorId] as Evaluator).score = vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      });

      try {
        await executeEvaluatorHandler({
          mastra,
          evaluatorId,
          input,
          output,
        });
      } catch (error) {
        expect(error.message).toEqual(errorMessage);
      }
    });
  });
});
