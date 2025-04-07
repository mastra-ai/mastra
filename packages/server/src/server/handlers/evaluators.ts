import type { Evaluator, Metric } from '@mastra/core/eval';
import type { Mastra } from '@mastra/core/mastra';
import { handleError } from './error';

type EvaluatorsContext = {
  mastra: Mastra;
};

/**
 * Handler to get all evaluators registered on all agents
 * @returns Record of evaluator names to evaluator instances
 */
export async function getEvaluatorsHandler({ mastra }: EvaluatorsContext): Promise<Record<string, Evaluator | Metric>> {
  try {
    const evaluators = mastra.getEvaluators();
    return evaluators;
  } catch (error) {
    return handleError(error, 'Error getting evaluators');
  }
}
