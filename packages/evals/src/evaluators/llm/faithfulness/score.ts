import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

/**
 * Calculates a faithfulness score based on outcomes
 * @param param0 The outcome, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateFaithfulnessScore({ outcomes, settings }: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const totalClaims = outcomes.length;
  const supportedClaims = outcomes.filter(v => v.outcome === 'yes').length;

  if (totalClaims === 0) {
    return { score: 0 };
  }

  const score = (supportedClaims / totalClaims) * settings.scale;
  return { score: roundToTwoDecimals(score) };
}
