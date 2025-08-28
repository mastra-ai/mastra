import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import { PROMPT_ALIGNMENT_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface PromptAlignmentOptions {
  scale?: number;
}

const analyzeOutputSchema = z.object({
  intentAlignment: z.object({
    score: z.number().min(0).max(1),
    primaryIntent: z.string(),
    isAddressed: z.boolean(),
    reasoning: z.string(),
  }),
  requirementsFulfillment: z.object({
    requirements: z.array(
      z.object({
        requirement: z.string(),
        isFulfilled: z.boolean(),
        reasoning: z.string(),
      }),
    ),
    overallScore: z.number().min(0).max(1),
  }),
  completeness: z.object({
    score: z.number().min(0).max(1),
    missingElements: z.array(z.string()),
    reasoning: z.string(),
  }),
  responseAppropriateness: z.object({
    score: z.number().min(0).max(1),
    formatAlignment: z.boolean(),
    toneAlignment: z.boolean(),
    reasoning: z.string(),
  }),
  overallAssessment: z.string(),
});

// Weight distribution for different aspects of prompt alignment
const SCORING_WEIGHTS = {
  INTENT_ALIGNMENT: 0.4, // 40% - Core intent is most important
  REQUIREMENTS_FULFILLMENT: 0.3, // 30% - Meeting specific requirements
  COMPLETENESS: 0.2, // 20% - Comprehensive response
  RESPONSE_APPROPRIATENESS: 0.1, // 10% - Format and tone matching
} as const;

export function createPromptAlignmentScorerLLM({
  model,
  options,
}: {
  model: MastraLanguageModel;
  options?: PromptAlignmentOptions;
}) {
  const scale = options?.scale || 1;

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Prompt Alignment (LLM)',
    description: 'Evaluates how well the agent response aligns with the intent and requirements of the user prompt',
    judge: {
      model,
      instructions: PROMPT_ALIGNMENT_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Analyze prompt-response alignment across multiple dimensions',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const userPrompt = getUserMessageFromRunInput(run.input) ?? '';
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        if (!userPrompt || !agentResponse) {
          throw new Error('Both user prompt and agent response are required for prompt alignment scoring');
        }

        return createAnalyzePrompt({
          userPrompt,
          agentResponse,
        });
      },
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult;

      if (!analysis) {
        // Default to 0 if analysis failed
        return 0;
      }

      /**
       * Prompt Alignment Scoring Algorithm
       *
       * Formula: (intent_score × 0.4 + requirements_score × 0.3 + completeness_score × 0.2 + appropriateness_score × 0.1) × scale
       *
       * This weighted approach ensures:
       * - Primary focus on intent alignment (40%)
       * - Strong emphasis on requirement fulfillment (30%)
       * - Consideration of response completeness (20%)
       * - Basic check for appropriate format/tone (10%)
       */

      const weightedScore =
        analysis.intentAlignment.score * SCORING_WEIGHTS.INTENT_ALIGNMENT +
        analysis.requirementsFulfillment.overallScore * SCORING_WEIGHTS.REQUIREMENTS_FULFILLMENT +
        analysis.completeness.score * SCORING_WEIGHTS.COMPLETENESS +
        analysis.responseAppropriateness.score * SCORING_WEIGHTS.RESPONSE_APPROPRIATENESS;

      const finalScore = weightedScore * scale;

      return roundToTwoDecimals(finalScore);
    })
    .generateReason({
      description: 'Generate human-readable explanation of prompt alignment evaluation',
      createPrompt: ({ run, results, score }) => {
        const userPrompt = getUserMessageFromRunInput(run.input) ?? '';
        const analysis = results.analyzeStepResult;

        if (!analysis) {
          return `Unable to analyze prompt alignment. Score: ${score}`;
        }

        return createReasonPrompt({
          userPrompt,
          score,
          scale,
          analysis: {
            intentAlignment: analysis.intentAlignment,
            requirementsFulfillment: analysis.requirementsFulfillment,
            completeness: analysis.completeness,
            responseAppropriateness: analysis.responseAppropriateness,
            overallAssessment: analysis.overallAssessment,
          },
        });
      },
    });
}
