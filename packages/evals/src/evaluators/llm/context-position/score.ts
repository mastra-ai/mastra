import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

/**
 * Calculates a context position score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateContextPositionScore({ outcomes, settings }: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const totalOutcomes = outcomes?.length || 0;
  if (totalOutcomes === 0) {
    return { score: 0 };
  }

  // Convert to binary scores (1 for yes, 0 for no)
  const binaryScores = outcomes.map(v => (v.outcome.trim().toLowerCase() === 'yes' ? 1 : 0));

  let weightedSum = 0;
  let maxPossibleSum = 0; // Track the maximum possible sum for normalization

  // Calculate position-weighted scores
  binaryScores.forEach((isRelevant, index) => {
    const positionWeight = 1 / (index + 1);
    if (isRelevant) {
      weightedSum += positionWeight;
    }
    maxPossibleSum += positionWeight; // Add to max possible sum regardless of relevance
  });

  if (weightedSum === 0) {
    return { score: 0 };
  }

  // Normalize against the maximum possible score
  const finalScore = (weightedSum / maxPossibleSum) * settings.scale;
  return { score: roundToTwoDecimals(finalScore) };
}
