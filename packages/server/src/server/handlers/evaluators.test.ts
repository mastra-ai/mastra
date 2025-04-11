import type { Evaluator } from '@mastra/core/eval';
import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEvaluatorsHandler } from './evaluators';

describe('Evaluators Handlers', () => {
  let mastra: Mastra;

  beforeEach(() => {
    vi.clearAllMocks();
    mastra = new Mastra();

    // Mock the getEvaluators method with type assertion
    mastra.getEvaluators = vi.fn().mockReturnValue({
      hallucination: { name: 'Hallucination Evaluator' } as unknown as Evaluator,
      'context-precision': { name: 'Context Precision Evaluator' } as unknown as Evaluator,
      'answer-relevance': { name: 'Answer Relevance Evaluator' } as unknown as Evaluator,
    });
  });

  describe('getEvaluatorsHandler', () => {
    it('should return all evaluators successfully', async () => {
      const result = await getEvaluatorsHandler({ mastra });

      expect(result).toEqual({
        hallucination: { name: 'Hallucination Evaluator' },
        'context-precision': { name: 'Context Precision Evaluator' },
        'answer-relevance': { name: 'Answer Relevance Evaluator' },
      });
      expect(mastra.getEvaluators).toHaveBeenCalled();
    });

    it('should handle errors when getting evaluators', async () => {
      const errorMessage = 'Failed to get evaluators';
      mastra.getEvaluators = vi.fn().mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await getEvaluatorsHandler({ mastra });

      expect(result).toEqual({
        message: errorMessage,
        status: 500,
      });
    });
  });
});
