import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import { CONTEXT_RELEVANCE_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface ContextRelevanceOptions {
  scale?: number;
  context?: string[];
  contextExtractor?: (input: ScorerRunInputForAgent, output: ScorerRunOutputForAgent) => string[];
  penalties?: {
    unusedHighRelevanceContext?: number; // Penalty per unused high-relevance context (default: 0.1)
    missingContextPerItem?: number; // Penalty per missing context item (default: 0.15)
    maxMissingContextPenalty?: number; // Maximum total missing context penalty (default: 0.5)
  };
}

const analyzeOutputSchema = z.object({
  evaluations: z.array(
    z.object({
      context_index: z.number(),
      contextPiece: z.string(),
      relevanceLevel: z.enum(['high', 'medium', 'low', 'none']),
      wasUsed: z.boolean(),
      reasoning: z.string(),
    }),
  ),
  missingContext: z.array(z.string()).optional().default([]),
  overallAssessment: z.string(),
});

// Default penalty constants for maintainability and clarity
const DEFAULT_PENALTIES = {
  UNUSED_HIGH_RELEVANCE_CONTEXT: 0.1, // 10% penalty per unused high-relevance context
  MISSING_CONTEXT_PER_ITEM: 0.15, // 15% penalty per missing context item
  MAX_MISSING_CONTEXT_PENALTY: 0.5, // Maximum 50% penalty for missing context
} as const;

export function createContextRelevanceScorerLLM({
  model,
  options,
}: {
  model: MastraLanguageModel;
  options: ContextRelevanceOptions;
}) {
  if (!options.context && !options.contextExtractor) {
    throw new Error('Either context or contextExtractor is required for Context Relevance scoring');
  }
  if (options.context && options.context.length === 0) {
    throw new Error('Context array cannot be empty if provided');
  }

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Context Relevance (LLM)',
    description: 'Evaluates how relevant and useful the provided context was for generating the agent response',
    judge: {
      model,
      instructions: CONTEXT_RELEVANCE_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Analyze the relevance and utility of provided context',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const userQuery = getUserMessageFromRunInput(run.input) ?? '';
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Get context either from options or extractor
        const context = options.contextExtractor ? options.contextExtractor(run.input!, run.output) : options.context!;

        if (context.length === 0) {
          // Create a minimal prompt that will trigger empty context handling
          // The LLM will return empty evaluations which will be handled in generateScore
          return createAnalyzePrompt({
            userQuery,
            agentResponse,
            providedContext: ['[No context was provided for evaluation]'],
          });
        }

        return createAnalyzePrompt({
          userQuery,
          agentResponse,
          providedContext: context,
        });
      },
    })
    .generateScore(({ results, run }) => {
      const evaluations = results.analyzeStepResult?.evaluations || [];

      // Check if this is the "no context" case
      const context = options.contextExtractor ? options.contextExtractor(run.input!, run.output) : options.context!;
      if (context.length === 0) {
        // Default score when no context is available
        // Return 1.0 since the agent had to work without any context
        return 1.0 * (options.scale || 1);
      }

      if (evaluations.length === 0) {
        // If no evaluations but missing context was identified, score should be low
        const missingContext = results.analyzeStepResult?.missingContext || [];
        return missingContext.length > 0 ? 0.0 : 1.0;
      }

      /**
       * Context Relevance Scoring Algorithm
       *
       * Formula: max(0, base_score - usage_penalty - missing_penalty) × scale
       *
       * Where:
       * - base_score = sum(relevance_weights) / (num_contexts × 1.0)
       * - usage_penalty = unused_high_relevance_count × penalty_rate
       * - missing_penalty = min(missing_count × penalty_rate, max_penalty)
       *
       * Relevance weights: high=1.0, medium=0.7, low=0.3, none=0.0
       */

      // Calculate weighted score based on relevance levels
      const relevanceWeights = {
        high: 1.0,
        medium: 0.7,
        low: 0.3,
        none: 0.0,
      };

      // Sum of actual relevance weights from LLM evaluation
      const totalWeight = evaluations.reduce((sum, evaluation) => {
        return sum + relevanceWeights[evaluation.relevanceLevel];
      }, 0);

      // Maximum possible weight if all contexts were high relevance
      const maxPossibleWeight = evaluations.length * relevanceWeights.high;

      // Base relevance score: actual_weight / max_possible_weight
      const relevanceScore = maxPossibleWeight > 0 ? totalWeight / maxPossibleWeight : 0;

      // Penalty for unused highly relevant context
      const highRelevanceUnused = evaluations.filter(
        evaluation => evaluation.relevanceLevel === 'high' && !evaluation.wasUsed,
      ).length;

      // Extract penalty configurations with defaults
      const penalties = options.penalties || {};
      const unusedPenaltyRate = penalties.unusedHighRelevanceContext ?? DEFAULT_PENALTIES.UNUSED_HIGH_RELEVANCE_CONTEXT;
      const missingPenaltyRate = penalties.missingContextPerItem ?? DEFAULT_PENALTIES.MISSING_CONTEXT_PER_ITEM;
      const maxMissingPenalty = penalties.maxMissingContextPenalty ?? DEFAULT_PENALTIES.MAX_MISSING_CONTEXT_PENALTY;

      const usagePenalty = highRelevanceUnused * unusedPenaltyRate;

      // Penalty for missing important context
      const missingContext = results.analyzeStepResult?.missingContext || [];
      const missingContextPenalty = Math.min(missingContext.length * missingPenaltyRate, maxMissingPenalty);

      // Final score calculation: base_score - penalties (clamped to [0,1])
      // Formula: max(0, relevance_score - usage_penalty - missing_penalty) × scale
      const finalScore = Math.max(0, relevanceScore - usagePenalty - missingContextPenalty);
      const scaledScore = finalScore * (options.scale || 1);

      return roundToTwoDecimals(scaledScore);
    })
    .generateReason({
      description: 'Generate human-readable explanation of context relevance evaluation',
      createPrompt: ({ run, results, score }) => {
        const userQuery = getUserMessageFromRunInput(run.input) ?? '';

        // Check if this is the "no context" case
        const context = options.contextExtractor ? options.contextExtractor(run.input!, run.output) : options.context!;
        if (context.length === 0) {
          // Return a special reason for no context
          return `No context was available for evaluation. The agent response was generated without any supporting context. Score: ${score}`;
        }

        const evaluations = results.analyzeStepResult?.evaluations || [];
        const missingContext = results.analyzeStepResult?.missingContext || [];

        return createReasonPrompt({
          userQuery,
          score,
          evaluations,
          missingContext,
          scale: options.scale || 1,
        });
      },
    });
}
