import type { Evaluator, EvaluationResult, Metric } from '@mastra/core/eval';
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

type ExecuteEvaluatorContext = {
  mastra: Mastra;
  evaluatorId: string;
  input: string;
  output: string;
  options?: Record<string, any>;
};

/**
 * Handler to execute a specific evaluator by its ID
 * @param context The execution context containing Mastra instance, evaluator ID, input, output, and options
 * @returns EvaluationResult from the executed evaluator
 */
export async function executeEvaluatorHandler({
  mastra,
  evaluatorId,
  input,
  output,
  options,
}: ExecuteEvaluatorContext): Promise<EvaluationResult | { status: number; message: string }> {
  try {
    const evaluators = mastra.getEvaluators();
    const evaluator = evaluators[evaluatorId];

    if (!evaluator) {
      return {
        status: 404,
        message: `Evaluator with ID "${evaluatorId}" not found`,
      };
    }

    // Check if the evaluator is an Evaluator (has score method) or a Metric (has measure method)
    if ('score' in evaluator) {
      // Execute the evaluator's score method
      const result = await evaluator.score({ input, output, options });
      return result;
    } else if ('measure' in evaluator) {
      // Execute the metric's measure method
      const result = await evaluator.measure(input, output);
      return result;
    } else {
      return {
        status: 400,
        message: `Invalid evaluator type for "${evaluatorId}"`,
      };
    }
  } catch (error) {
    return handleError(error, `Error executing evaluator "${evaluatorId}"`);
  }
}
