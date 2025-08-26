import type { MastraLanguageModel } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import {
  createContextRelevancePrompt,
  createContextPrecisionReasonPrompt,
  CONTEXT_PRECISION_AGENT_INSTRUCTIONS,
} from './prompts';

export interface ContextPrecisionMetricOptions {
  scale?: number;
  context?: string[];
  contextExtractor?: (input: ScorerRunInputForAgent, output: ScorerRunOutputForAgent) => string[];
}

const contextRelevanceOutputSchema = z.object({
  verdicts: z.array(
    z.object({
      context_index: z.number(),
      verdict: z.string(),
      reason: z.string(),
    }),
  ),
});

export function createContextPrecisionScorer({
  model,
  options,
}: {
  model: MastraLanguageModel;
  options: ContextPrecisionMetricOptions;
}) {
  if (!options.context && !options.contextExtractor) {
    throw new Error('Either context or contextExtractor is required for Context Precision scoring');
  }
  if (options.context && options.context.length === 0) {
    throw new Error('Context array cannot be empty if provided');
  }

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Context Precision Scorer',
    description:
      'A scorer that evaluates the relevance and precision of retrieved context nodes for generating expected outputs',
    judge: {
      model,
      instructions: CONTEXT_PRECISION_AGENT_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Evaluate the relevance of each context piece for generating the expected output',
      outputSchema: contextRelevanceOutputSchema,
      createPrompt: ({ run }) => {
        const input = getUserMessageFromRunInput(run.input) ?? '';
        const output = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Get context either from options or extractor
        const context = options.contextExtractor ? options.contextExtractor(run.input!, run.output) : options.context!;

        if (context.length === 0) {
          throw new Error('No context available for evaluation');
        }

        return createContextRelevancePrompt({
          input,
          output,
          context,
        });
      },
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult || results.analyzeStepResult.verdicts.length === 0) {
        return 0;
      }

      const verdicts = results.analyzeStepResult.verdicts;

      // Sort verdicts by context_index to ensure proper order
      const sortedVerdicts = verdicts.sort((a, b) => a.context_index - b.context_index);

      // Calculate Mean Average Precision (MAP)
      let sumPrecision = 0;
      let relevantCount = 0;

      for (let i = 0; i < sortedVerdicts.length; i++) {
        const targetVerdict = sortedVerdicts[i];
        const isRelevant = targetVerdict?.verdict?.toLowerCase().trim() === 'yes';

        if (isRelevant) {
          relevantCount++;
          // Precision at position i+1 = relevant_items_up_to_position / (i+1)
          const precisionAtI = relevantCount / (i + 1);
          sumPrecision += precisionAtI;
        }
      }

      // If no relevant context found, score is 0
      if (relevantCount === 0) {
        return 0;
      }

      // Mean Average Precision = sum_of_precisions / total_relevant_items
      const map = sumPrecision / relevantCount;
      const score = map * (options.scale || 1);

      return roundToTwoDecimals(score);
    })
    .generateReason({
      description: 'Reason about the context precision results',
      createPrompt: ({ run, results, score }) => {
        const input = getUserMessageFromRunInput(run.input) ?? '';
        const output = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Get context either from options or extractor (same as in analyze)
        const context = options.contextExtractor ? options.contextExtractor(run.input!, run.output) : options.context!;

        return createContextPrecisionReasonPrompt({
          input,
          output,
          context,
          score,
          scale: options.scale || 1,
          verdicts: (results.analyzeStepResult?.verdicts || []) as {
            context_index: number;
            verdict: string;
            reason: string;
          }[],
        });
      },
    });
}
