import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import {
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
  getCombinedSystemPrompt,
  roundToTwoDecimals,
} from '../../utils';
import { PROMPT_ALIGNMENT_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface PromptAlignmentOptions {
  scale?: number;
  evaluationMode?: 'user' | 'system' | 'both';
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
  USER: {
    INTENT_ALIGNMENT: 0.4, // 40% - Core intent is most important
    REQUIREMENTS_FULFILLMENT: 0.3, // 30% - Meeting specific requirements
    COMPLETENESS: 0.2, // 20% - Comprehensive response
    RESPONSE_APPROPRIATENESS: 0.1, // 10% - Format and tone matching
  },
  SYSTEM: {
    INTENT_ALIGNMENT: 0.35, // 35% - Following system behavioral guidelines
    REQUIREMENTS_FULFILLMENT: 0.35, // 35% - Meeting system constraints
    COMPLETENESS: 0.15, // 15% - Adherence to all system rules
    RESPONSE_APPROPRIATENESS: 0.15, // 15% - Consistency with system tone/format
  },
  BOTH: {
    // When evaluating both, we weight user alignment at 70% and system at 30%
    USER_WEIGHT: 0.7,
    SYSTEM_WEIGHT: 0.3,
  },
} as const;

export function createPromptAlignmentScorerLLM({
  model,
  options,
}: {
  model: MastraLanguageModel;
  options?: PromptAlignmentOptions;
}) {
  const scale = options?.scale || 1;
  const evaluationMode = options?.evaluationMode || 'both';

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
        const systemPrompt = getCombinedSystemPrompt(run.input) ?? '';
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Validation based on evaluation mode
        if (evaluationMode === 'user' && !userPrompt) {
          throw new Error('User prompt is required for user prompt alignment scoring');
        }
        if (evaluationMode === 'system' && !systemPrompt) {
          throw new Error('System prompt is required for system prompt alignment scoring');
        }
        if (evaluationMode === 'both' && (!userPrompt || !systemPrompt)) {
          throw new Error('Both user and system prompts are required for combined alignment scoring');
        }
        if (!agentResponse) {
          throw new Error('Agent response is required for prompt alignment scoring');
        }

        return createAnalyzePrompt({
          userPrompt,
          systemPrompt,
          agentResponse,
          evaluationMode,
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
       * Adapts based on evaluation mode:
       * - User mode: Evaluates user prompt alignment only
       * - System mode: Evaluates system prompt compliance only
       * - Both mode: Weighted combination (70% user, 30% system)
       */

      let weightedScore = 0;

      if (evaluationMode === 'user') {
        // User prompt alignment only
        weightedScore =
          analysis.intentAlignment.score * SCORING_WEIGHTS.USER.INTENT_ALIGNMENT +
          analysis.requirementsFulfillment.overallScore * SCORING_WEIGHTS.USER.REQUIREMENTS_FULFILLMENT +
          analysis.completeness.score * SCORING_WEIGHTS.USER.COMPLETENESS +
          analysis.responseAppropriateness.score * SCORING_WEIGHTS.USER.RESPONSE_APPROPRIATENESS;
      } else if (evaluationMode === 'system') {
        // System prompt compliance only
        weightedScore =
          analysis.intentAlignment.score * SCORING_WEIGHTS.SYSTEM.INTENT_ALIGNMENT +
          analysis.requirementsFulfillment.overallScore * SCORING_WEIGHTS.SYSTEM.REQUIREMENTS_FULFILLMENT +
          analysis.completeness.score * SCORING_WEIGHTS.SYSTEM.COMPLETENESS +
          analysis.responseAppropriateness.score * SCORING_WEIGHTS.SYSTEM.RESPONSE_APPROPRIATENESS;
      } else {
        // Both mode: combine user and system scores
        const userScore =
          analysis.intentAlignment.score * SCORING_WEIGHTS.USER.INTENT_ALIGNMENT +
          analysis.requirementsFulfillment.overallScore * SCORING_WEIGHTS.USER.REQUIREMENTS_FULFILLMENT +
          analysis.completeness.score * SCORING_WEIGHTS.USER.COMPLETENESS +
          analysis.responseAppropriateness.score * SCORING_WEIGHTS.USER.RESPONSE_APPROPRIATENESS;

        // For system analysis, we'll need to check if there's a systemAnalysis field
        // If analyzing both, the analysis should contain both user and system analysis
        // For now, we'll use the same analysis for both as a baseline
        const systemScore = userScore; // This will be updated when we modify the analysis structure

        weightedScore = userScore * SCORING_WEIGHTS.BOTH.USER_WEIGHT + systemScore * SCORING_WEIGHTS.BOTH.SYSTEM_WEIGHT;
      }

      const finalScore = weightedScore * scale;

      return roundToTwoDecimals(finalScore);
    })
    .generateReason({
      description: 'Generate human-readable explanation of prompt alignment evaluation',
      createPrompt: ({ run, results, score }) => {
        const userPrompt = getUserMessageFromRunInput(run.input) ?? '';
        const systemPrompt = getCombinedSystemPrompt(run.input) ?? '';
        const analysis = results.analyzeStepResult;

        if (!analysis) {
          return `Unable to analyze prompt alignment. Score: ${score}`;
        }

        return createReasonPrompt({
          userPrompt,
          systemPrompt,
          score,
          scale,
          analysis,
          evaluationMode,
        });
      },
    });
}
