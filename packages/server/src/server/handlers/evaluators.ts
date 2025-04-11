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
    const constructedEvaluators = Object.entries(evaluators).reduce(
      (acc, [key, value]) => {
        const newEvalObject = {
          ...(value as Evaluator),
          name: (value as Evaluator)?.name,
          score: (value as Evaluator)?.score,
          type: (value as any)?.type,
          model: (value as any)?.model,
          modelId: (value as any)?.modelId,
          provider: (value as any)?.provider,
          instructions: (value as any)?.instructions,
          reasonTemplate: (value as any)?.reasonTemplate,
          evalTemplate: (value as any)?.evalTemplate,
          settings: (value as any)?.settings,
        };

        acc[key] = newEvalObject;
        return acc;
      },
      {} as Record<string, Evaluator | Metric>,
    );
    return constructedEvaluators;
  } catch (error) {
    return handleError(error, 'Error getting evaluators');
  }
}
