import type { Trajectory, TrajectoryExpectation, TrajectoryStep } from '@mastra/core/evals';
import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod';
import { getUserMessageFromRunInput, getAssistantMessageFromRunOutput, roundToTwoDecimals } from '../../utils';
import { TRAJECTORY_EVALUATION_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface TrajectoryAccuracyLLMOptions {
  /** The LLM model to use as judge */
  model: MastraModelConfig;
  /** Optional expected trajectory to compare against */
  expectedTrajectory?: Trajectory;
}

/**
 * Resolve a TrajectoryExpectation (from dataset item) into a Trajectory for formatting.
 */
function expectationToTrajectory(expectation: TrajectoryExpectation): Trajectory | undefined {
  if (!expectation.steps || expectation.steps.length === 0) return undefined;
  return { steps: expectation.steps };
}

const analyzeOutputSchema = z.object({
  stepEvaluations: z.array(
    z.object({
      stepName: z.string().describe('Name of the step (tool name or action)'),
      wasNecessary: z.boolean().describe('Whether this step was necessary for the task'),
      wasInOrder: z.boolean().describe('Whether this step was in a logical position in the sequence'),
      reasoning: z.string().describe('Brief explanation of the evaluation'),
    }),
  ),
  missingSteps: z.array(z.string()).optional().describe('Steps that should have been taken but were not'),
  extraSteps: z.array(z.string()).optional().describe('Steps that were unnecessary or redundant'),
  overallAssessment: z.string().describe('Brief overall assessment of the trajectory quality'),
});

function formatStepDetails(step: TrajectoryStep): string {
  switch (step.stepType) {
    case 'tool_call':
    case 'mcp_tool_call': {
      const parts: string[] = [];
      if (step.toolArgs !== undefined) parts.push(`args: ${JSON.stringify(step.toolArgs)}`);
      if (step.toolResult !== undefined) parts.push(`result: ${JSON.stringify(step.toolResult)}`);
      return parts.length > 0 ? ` (${parts.join(', ')})` : '';
    }
    case 'model_generation':
      return step.modelId ? ` (model: ${step.modelId})` : '';
    case 'workflow_step':
      return step.output !== undefined ? ` (output: ${JSON.stringify(step.output)})` : '';
    default:
      return '';
  }
}

function formatTrajectory(trajectory: Trajectory): string {
  return trajectory.steps
    .map((step: TrajectoryStep, i: number) => {
      return `${i + 1}. [${step.stepType}] ${step.name}${formatStepDetails(step)}`;
    })
    .join('\n');
}

/**
 * Creates an LLM-based trajectory accuracy scorer that evaluates the quality
 * of an agent's action sequence using an LLM judge.
 *
 * This scorer extracts the agent's tool call trajectory and asks an LLM to evaluate
 * whether the trajectory was appropriate, efficient, and complete. When an expected
 * trajectory is provided, it compares against it. Otherwise, it evaluates the trajectory
 * based on the task requirements.
 *
 * @param options - Configuration for the trajectory scorer
 * @returns A scorer that evaluates trajectory quality
 *
 * @example
 * ```ts
 * import { createTrajectoryAccuracyScorerLLM } from '@mastra/evals/scorers';
 *
 * // Without expected trajectory (evaluates quality based on task)
 * const scorer = createTrajectoryAccuracyScorerLLM({
 *   model: { provider: 'openai', name: 'gpt-4o' },
 * });
 *
 * // With expected trajectory
 * const scorerWithExpected = createTrajectoryAccuracyScorerLLM({
 *   model: { provider: 'openai', name: 'gpt-4o' },
 *   expectedTrajectory: {
 *     steps: [
 *       { stepType: 'tool_call', name: 'search' },
 *       { stepType: 'tool_call', name: 'summarize' },
 *     ],
 *   },
 * });
 * ```
 */
export function createTrajectoryAccuracyScorerLLM({
  model,
  expectedTrajectory: staticExpectedTrajectory,
}: TrajectoryAccuracyLLMOptions) {
  return createScorer({
    id: 'llm-trajectory-accuracy-scorer',
    name: 'Trajectory Accuracy (LLM)',
    description: staticExpectedTrajectory
      ? 'Evaluates the trajectory against an expected trajectory using LLM analysis'
      : 'Evaluates the quality and appropriateness of the trajectory using LLM analysis',
    judge: {
      model,
      instructions: TRAJECTORY_EVALUATION_INSTRUCTIONS,
    },
    type: 'trajectory',
  })
    .preprocess(async ({ run }) => {
      // run.output is a Trajectory (pre-extracted by runEvals pipeline)
      const actualTrajectory: Trajectory = run.output;

      // Resolve expectedTrajectory: prefer constructor option, fallback to dataset item
      let resolvedExpectedTrajectory: Trajectory | undefined = staticExpectedTrajectory;
      if (!resolvedExpectedTrajectory && run.expectedTrajectory) {
        resolvedExpectedTrajectory = expectationToTrajectory(run.expectedTrajectory as TrajectoryExpectation);
      }

      return {
        actualTrajectory,
        actualTrajectoryFormatted: formatTrajectory(actualTrajectory),
        expectedTrajectoryFormatted: resolvedExpectedTrajectory
          ? formatTrajectory(resolvedExpectedTrajectory)
          : undefined,
        hasSteps: actualTrajectory.steps.length > 0,
      };
    })
    .analyze({
      description: 'Analyze the quality and appropriateness of the agent trajectory',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run, results }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        // Use rawOutput from the trajectory to extract the agent's text response
        const agentResponse = getAssistantMessageFromRunOutput(run.output.rawOutput) ?? '';

        return createAnalyzePrompt({
          userInput,
          agentResponse,
          actualTrajectory: results.preprocessStepResult?.actualTrajectoryFormatted ?? 'No steps taken',
          expectedTrajectory: results.preprocessStepResult?.expectedTrajectoryFormatted,
        });
      },
    })
    .generateScore(({ results }) => {
      const stepEvaluations = results.analyzeStepResult?.stepEvaluations || [];

      if (stepEvaluations.length === 0) {
        const missingSteps = results.analyzeStepResult?.missingSteps || [];
        return missingSteps.length > 0 ? 0.0 : 1.0;
      }

      const necessarySteps = stepEvaluations.filter(e => e.wasNecessary).length;
      const orderedSteps = stepEvaluations.filter(e => e.wasInOrder).length;
      const totalSteps = stepEvaluations.length;

      const missingSteps = results.analyzeStepResult?.missingSteps || [];
      const missingPenalty = missingSteps.length > 0 ? missingSteps.length / (totalSteps + missingSteps.length) : 0;

      // Weight: 60% necessity, 30% ordering, 10% missing penalty
      const necessityScore = necessarySteps / totalSteps;
      const orderScore = orderedSteps / totalSteps;
      const score = necessityScore * 0.6 + orderScore * 0.3 - missingPenalty * 0.1;

      return roundToTwoDecimals(Math.max(0, Math.min(1, score)));
    })
    .generateReason({
      description: 'Generate human-readable explanation of trajectory evaluation',
      createPrompt: ({ run, results, score }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const stepEvaluations = results.analyzeStepResult?.stepEvaluations || [];
        const missingSteps = results.analyzeStepResult?.missingSteps || [];
        const extraSteps = results.analyzeStepResult?.extraSteps || [];

        return createReasonPrompt({
          userInput,
          score,
          stepEvaluations,
          missingSteps,
          extraSteps,
        });
      },
    });
}
