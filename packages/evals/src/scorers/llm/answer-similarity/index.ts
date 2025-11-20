import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput } from '../../utils';
import { createExtractPrompt, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface AnswerSimilarityOptions {
  requireGroundTruth?: boolean; // Fail if ground truth is missing (default: true)
  semanticThreshold?: number; // Weight for semantic matches vs exact (default: 0.8)
  exactMatchBonus?: number; // Additional score for exact matches (default: 0.2)
  missingPenalty?: number; // Penalty per missing key concept (default: 0.15)
  contradictionPenalty?: number; // Penalty for contradictory information (default: 0.3)
  extraInfoPenalty?: number; // Penalty for extra information not in ground truth (default: 0.05)
  scale?: number; // Score scaling factor (default: 1)
}

export const ANSWER_SIMILARITY_DEFAULT_OPTIONS: Required<AnswerSimilarityOptions> = {
  requireGroundTruth: true,
  semanticThreshold: 0.8,
  exactMatchBonus: 0.2,
  missingPenalty: 0.15,
  contradictionPenalty: 1.0,
  extraInfoPenalty: 0.05,
  scale: 1,
};

export const ANSWER_SIMILARITY_INSTRUCTIONS = `
You are a precise answer similarity evaluator for CI/CD testing. Your role is to compare agent outputs against ground truth answers to ensure consistency and accuracy in automated testing.

Key Principles:
1. Focus on semantic equivalence, not just string matching
2. Recognize that different phrasings can convey the same information
3. Identify missing critical information from the ground truth
4. Detect contradictions between output and ground truth
5. Provide actionable feedback for improving answer accuracy
6. Be strict but fair - partial credit for partial matches
`;

const extractOutputSchema = z.object({
  outputUnits: z.array(z.string()),
  groundTruthUnits: z.array(z.string()),
});

const analyzeOutputSchema = z.object({
  matches: z.array(
    z.object({
      groundTruthUnit: z.string(),
      outputUnit: z.string().nullable(),
      matchType: z.enum(['exact', 'semantic', 'partial', 'missing']),
      explanation: z.string(),
    }),
  ),
  extraInOutput: z.array(z.string()),
  contradictions: z.array(
    z.object({
      outputUnit: z.string(),
      groundTruthUnit: z.string(),
      explanation: z.string(),
    }),
  ),
});

export function createAnswerSimilarityScorer({
  model,
  options = ANSWER_SIMILARITY_DEFAULT_OPTIONS,
}: {
  model: MastraModelConfig;
  options?: AnswerSimilarityOptions;
}) {
  const mergedOptions = { ...ANSWER_SIMILARITY_DEFAULT_OPTIONS, ...options };
  return createScorer({
    id: 'answer-similarity-scorer',
    name: 'Answer Similarity Scorer',
    description: 'Evaluates how similar an agent output is to a ground truth answer for CI/CD testing',
    judge: {
      model,
      instructions: ANSWER_SIMILARITY_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess({
      description: 'Extract semantic units from output and ground truth',
      outputSchema: extractOutputSchema,
      createPrompt: ({ run }) => {
        // Check if ground truth exists
        if (!run.groundTruth) {
          if (mergedOptions.requireGroundTruth) {
            throw new Error('Answer Similarity Scorer requires ground truth to be provided');
          }
          // If ground truth is not required and missing, return empty units
          return createExtractPrompt({
            output: '',
            groundTruth: '',
          });
        }

        const output = getAssistantMessageFromRunOutput(run.output) ?? '';
        const groundTruth = typeof run.groundTruth === 'string' ? run.groundTruth : JSON.stringify(run.groundTruth);

        return createExtractPrompt({
          output,
          groundTruth,
        });
      },
    })
    .analyze({
      description: 'Compare semantic units between output and ground truth',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ results }) => {
        const outputUnits = results.preprocessStepResult?.outputUnits || [];
        const groundTruthUnits = results.preprocessStepResult?.groundTruthUnits || [];

        return createAnalyzePrompt({
          outputUnits,
          groundTruthUnits,
        });
      },
    })
    .generateScore(({ run, results }) => {
      // Handle missing ground truth
      if (!run.groundTruth) {
        return 0;
      }

      const analysis = results.analyzeStepResult;
      if (!analysis) {
        return 0;
      }

      // Calculate base score from matches
      let score = 0;
      const totalUnits = analysis.matches.length;

      if (totalUnits === 0) {
        // No ground truth units to compare - return worst possible score
        return 0;
      }

      // Score each match based on quality
      for (const match of analysis.matches) {
        switch (match.matchType) {
          case 'exact':
            score += 1.0 + mergedOptions.exactMatchBonus;
            break;
          case 'semantic':
            score += mergedOptions.semanticThreshold;
            break;
          case 'partial':
            score += mergedOptions.semanticThreshold * 0.5; // Half credit for partial matches
            break;
          case 'missing':
            score -= mergedOptions.missingPenalty;
            break;
        }
      }

      // Normalize by total units (accounting for exact match bonus)
      const maxPossibleScore = totalUnits * (1.0 + mergedOptions.exactMatchBonus);
      score = score / maxPossibleScore;

      // Apply penalties for contradictions
      const contradictionPenalty = analysis.contradictions.length * mergedOptions.contradictionPenalty;
      score -= contradictionPenalty;

      // Apply mild penalty for extra information (can be good or bad depending on use case)
      const extraInfoPenalty = Math.min(
        analysis.extraInOutput.length * mergedOptions.extraInfoPenalty,
        0.2, // Cap extra info penalty at 0.2
      );
      score -= extraInfoPenalty;

      // Ensure score is between 0 and 1, then scale
      score = Math.max(0, Math.min(1, score));
      return roundToTwoDecimals(score * mergedOptions.scale);
    })
    .generateReason({
      description: 'Generate explanation of similarity score',
      createPrompt: ({ run, results, score }) => {
        if (!run.groundTruth) {
          return 'No ground truth was provided for comparison. Score is 0 by default.';
        }

        const output = getAssistantMessageFromRunOutput(run.output) ?? '';
        const groundTruth = typeof run.groundTruth === 'string' ? run.groundTruth : JSON.stringify(run.groundTruth);

        return createReasonPrompt({
          output,
          groundTruth,
          score,
          analysis: results.analyzeStepResult,
          scale: mergedOptions.scale,
        });
      },
    });
}
