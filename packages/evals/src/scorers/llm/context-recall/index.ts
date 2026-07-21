import { compileSchema } from '@internal/types-builder/compile-zod';
import { createScorer } from '@mastra/core/evals';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod/v4';
import { roundToTwoDecimals, isScorerRunInputForAgent, isScorerRunOutputForAgent } from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
import {
  createClaimExtractionPrompt,
  createClaimAttributionPrompt,
  createContextRecallReasonPrompt,
  CONTEXT_RECALL_AGENT_INSTRUCTIONS,
} from './prompts';

export interface ContextRecallMetricOptions {
  scale?: number;
  context?: string[];
  contextExtractor?: (input: ScorerRunInputForAgent, output: ScorerRunOutputForAgent) => string[];
}

const claimExtractionOutputSchema = compileSchema(
  z.object({
    claims: z.array(z.string()),
  }),
);

const claimAttributionOutputSchema = compileSchema(
  z.object({
    verdicts: z.array(
      z.object({
        verdict: z.string(),
        reason: z.string(),
      }),
    ),
  }),
);

const getContext = ({
  input,
  output,
  options,
}: {
  input?: ScorerRunInputForLLMJudge;
  output: ScorerRunOutputForLLMJudge;
  options: ContextRecallMetricOptions;
}) => {
  if (options.contextExtractor && isScorerRunInputForAgent(input) && isScorerRunOutputForAgent(output)) {
    return options.contextExtractor(input, output);
  }

  return options.context ?? [];
};

export function createContextRecallScorer({
  model,
  options,
}: {
  model: MastraModelConfig;
  options: ContextRecallMetricOptions;
}) {
  if (!options.context && !options.contextExtractor) {
    throw new Error('Either context or contextExtractor is required for Context Recall scoring');
  }
  if (options.context && options.context.length === 0) {
    throw new Error('Context array cannot be empty if provided');
  }

  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'context-recall-scorer',
    name: 'Context Recall Scorer',
    description:
      'A scorer that evaluates how well retrieved context covers the claims in a ground-truth reference answer',
    judge: {
      model,
      instructions: CONTEXT_RECALL_AGENT_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess({
      description: 'Extract atomic claims from the ground-truth answer',
      outputSchema: claimExtractionOutputSchema,
      createPrompt: ({ run }) => {
        if (!run.groundTruth) {
          return createClaimExtractionPrompt({ groundTruth: '' });
        }

        const groundTruth = typeof run.groundTruth === 'string' ? run.groundTruth : JSON.stringify(run.groundTruth);
        return createClaimExtractionPrompt({ groundTruth });
      },
    })
    .analyze({
      description: 'Check if each ground-truth claim is attributable to the retrieval context',
      outputSchema: claimAttributionOutputSchema,
      createPrompt: ({ results, run }) => {
        const context = getContext({ input: run.input, output: run.output, options });
        return createClaimAttributionPrompt({
          claims: results.preprocessStepResult?.claims || [],
          context,
        });
      },
    })
    .generateScore(({ results, run }) => {
      if (!run.groundTruth) {
        return 0;
      }

      const totalClaims = results.preprocessStepResult?.claims?.length ?? 0;

      if (totalClaims === 0) {
        return 0;
      }

      const verdicts = results.analyzeStepResult?.verdicts || [];
      const attributedClaims = verdicts.filter(v => v.verdict.toLowerCase().trim() === 'yes').length;
      const score = Math.min(1, attributedClaims / totalClaims) * (options.scale || 1);

      return roundToTwoDecimals(score);
    })
    .generateReason({
      description: 'Explain the context recall evaluation results',
      createPrompt: ({ run, results, score }) => {
        const groundTruth = run.groundTruth
          ? typeof run.groundTruth === 'string'
            ? run.groundTruth
            : JSON.stringify(run.groundTruth)
          : '';

        const context = getContext({ input: run.input, output: run.output, options });

        return createContextRecallReasonPrompt({
          groundTruth,
          context,
          score,
          scale: options.scale || 1,
          verdicts: (results.analyzeStepResult?.verdicts || []) as {
            verdict: string;
            reason: string;
          }[],
        });
      },
    });
}
