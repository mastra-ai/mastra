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
          throw new Error('No context available for evaluation');
        }

        return createAnalyzePrompt({
          userQuery,
          agentResponse,
          providedContext: context,
        });
      },
    })
    .generateScore(({ results }) => {
      const evaluations = results.analyzeStepResult?.evaluations || [];

      if (evaluations.length === 0) {
        // If no evaluations but missing context was identified, score should be low
        const missingContext = results.analyzeStepResult?.missingContext || [];
        return missingContext.length > 0 ? 0.0 : 1.0;
      }

      // Calculate weighted score based on relevance levels
      const relevanceWeights = {
        high: 1.0,
        medium: 0.7,
        low: 0.3,
        none: 0.0,
      };

      const totalWeight = evaluations.reduce((sum, evaluation) => {
        return sum + relevanceWeights[evaluation.relevanceLevel];
      }, 0);

      const maxPossibleWeight = evaluations.length * relevanceWeights.high;

      // Base score from relevance
      const relevanceScore = maxPossibleWeight > 0 ? totalWeight / maxPossibleWeight : 0;

      // Penalty for unused highly relevant context
      const highRelevanceUnused = evaluations.filter(
        evaluation => evaluation.relevanceLevel === 'high' && !evaluation.wasUsed,
      ).length;

      const usagePenalty = highRelevanceUnused * 0.1; // 10% penalty per unused high-relevance context

      // Penalty for missing important context
      const missingContext = results.analyzeStepResult?.missingContext || [];
      const missingContextPenalty = Math.min(missingContext.length * 0.15, 0.5); // Up to 50% penalty

      const finalScore = Math.max(0, relevanceScore - usagePenalty - missingContextPenalty);
      const scaledScore = finalScore * (options.scale || 1);

      return roundToTwoDecimals(scaledScore);
    })
    .generateReason({
      description: 'Generate human-readable explanation of context relevance evaluation',
      createPrompt: ({ run, results, score }) => {
        const userQuery = getUserMessageFromRunInput(run.input) ?? '';
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
