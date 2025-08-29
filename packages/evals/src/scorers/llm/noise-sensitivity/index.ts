import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import { NOISE_SENSITIVITY_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface NoiseSensitivityOptions {
  baselineResponse: string;
  noisyQuery: string;
  noiseType?: string;
  scoring?: {
    impactWeights?: {
      none?: number; // Weight for no impact (default: 1.0)
      minimal?: number; // Weight for minimal impact (default: 0.85)
      moderate?: number; // Weight for moderate impact (default: 0.6)
      significant?: number; // Weight for significant impact (default: 0.3)
      severe?: number; // Weight for severe impact (default: 0.1)
    };
    penalties?: {
      majorIssuePerItem?: number; // Penalty per major issue (default: 0.1)
      maxMajorIssuePenalty?: number; // Maximum major issue penalty (default: 0.3)
    };
    discrepancyThreshold?: number; // Threshold for LLM vs calculated score discrepancy (default: 0.2)
  };
}

const analyzeOutputSchema = z.object({
  dimensions: z.array(
    z.object({
      dimension: z.string(),
      impactLevel: z.enum(['none', 'minimal', 'moderate', 'significant', 'severe']),
      specificChanges: z.string(),
      noiseInfluence: z.string(),
    }),
  ),
  overallAssessment: z.string(),
  majorIssues: z.array(z.string()).optional().default([]),
  robustnessScore: z.number().min(0).max(1),
});

// Default scoring constants for maintainability and clarity
const DEFAULT_IMPACT_WEIGHTS = {
  none: 1.0,
  minimal: 0.85,
  moderate: 0.6,
  significant: 0.3,
  severe: 0.1,
} as const;

const DEFAULT_SCORING = {
  MAJOR_ISSUE_PENALTY_PER_ITEM: 0.1, // 10% penalty per major issue
  MAX_MAJOR_ISSUE_PENALTY: 0.3, // Maximum 30% penalty for major issues
  DISCREPANCY_THRESHOLD: 0.2, // Threshold for choosing conservative score
} as const;

export function createNoiseSensitivityScorerLLM({
  model,
  options,
}: {
  model: MastraLanguageModel;
  options: NoiseSensitivityOptions;
}) {
  if (!options.baselineResponse || !options.noisyQuery) {
    throw new Error('Both baselineResponse and noisyQuery are required for Noise Sensitivity scoring');
  }

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Noise Sensitivity (LLM)',
    description: 'Evaluates how robust an agent is when exposed to irrelevant, distracting, or misleading information',
    judge: {
      model,
      instructions: NOISE_SENSITIVITY_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Analyze the impact of noise on agent response quality',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const originalQuery = getUserMessageFromRunInput(run.input) ?? '';
        const noisyResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        if (!originalQuery || !noisyResponse) {
          throw new Error('Both original query and noisy response are required for evaluation');
        }

        return createAnalyzePrompt({
          userQuery: originalQuery,
          baselineResponse: options.baselineResponse,
          noisyQuery: options.noisyQuery,
          noisyResponse,
          noiseType: options.noiseType,
        });
      },
    })
    .generateScore(({ results }) => {
      const analysisResult = results.analyzeStepResult;

      if (!analysisResult) {
        throw new Error('Analysis step failed to produce results');
      }

      // Use the LLM's robustness score as primary score
      let finalScore = analysisResult.robustnessScore;

      // Validate score bounds
      finalScore = Math.max(0, Math.min(1, finalScore));

      /**
       * Noise Sensitivity Scoring Algorithm
       *
       * Formula: max(0, min(llm_score, calculated_score) - issues_penalty)
       *
       * Where:
       * - llm_score = direct robustness score from LLM analysis
       * - calculated_score = sum(impact_weights) / num_dimensions
       * - issues_penalty = min(major_issues_count × penalty_rate, max_penalty)
       *
       * Impact weights: none=1.0, minimal=0.85, moderate=0.6, significant=0.3, severe=0.1
       * Conservative approach: uses lower of LLM vs calculated score when they diverge
       */

      // Extract scoring configurations with defaults
      const scoring = options.scoring || {};
      const impactWeights = {
        none: scoring.impactWeights?.none ?? DEFAULT_IMPACT_WEIGHTS.none,
        minimal: scoring.impactWeights?.minimal ?? DEFAULT_IMPACT_WEIGHTS.minimal,
        moderate: scoring.impactWeights?.moderate ?? DEFAULT_IMPACT_WEIGHTS.moderate,
        significant: scoring.impactWeights?.significant ?? DEFAULT_IMPACT_WEIGHTS.significant,
        severe: scoring.impactWeights?.severe ?? DEFAULT_IMPACT_WEIGHTS.severe,
      };
      const discrepancyThreshold = scoring.discrepancyThreshold ?? DEFAULT_SCORING.DISCREPANCY_THRESHOLD;
      const majorIssuePenaltyRate =
        scoring.penalties?.majorIssuePerItem ?? DEFAULT_SCORING.MAJOR_ISSUE_PENALTY_PER_ITEM;
      const maxMajorIssuePenalty = scoring.penalties?.maxMajorIssuePenalty ?? DEFAULT_SCORING.MAX_MAJOR_ISSUE_PENALTY;

      // Additional validation based on impact levels
      const dimensions = analysisResult.dimensions || [];
      if (dimensions.length > 0) {
        // Calculate average impact across dimensions
        const averageImpact =
          dimensions.reduce((sum, dim) => {
            return sum + impactWeights[dim.impactLevel];
          }, 0) / dimensions.length;

        // If there's a significant discrepancy, use the more conservative score
        const calculatedScore = averageImpact;
        if (Math.abs(finalScore - calculatedScore) > discrepancyThreshold) {
          finalScore = Math.min(finalScore, calculatedScore);
        }
      }

      // Apply penalty for major issues
      const majorIssues = analysisResult.majorIssues || [];
      const issuesPenalty = Math.min(majorIssues.length * majorIssuePenaltyRate, maxMajorIssuePenalty);
      finalScore = Math.max(0, finalScore - issuesPenalty);

      return roundToTwoDecimals(finalScore);
    })
    .generateReason({
      description: 'Generate human-readable explanation of noise sensitivity evaluation',
      createPrompt: ({ run, results, score }) => {
        const originalQuery = getUserMessageFromRunInput(run.input) ?? '';
        const analysisResult = results.analyzeStepResult;

        if (!analysisResult) {
          throw new Error('Analysis step failed to produce results for reason generation');
        }

        return createReasonPrompt({
          userQuery: originalQuery,
          score,
          dimensions: analysisResult.dimensions || [],
          majorIssues: analysisResult.majorIssues || [],
          overallAssessment: analysisResult.overallAssessment,
        });
      },
    });
}
