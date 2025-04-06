import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

/**
 * Calculates a contextual recall score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateContextualRecallScore({
  outcomes,
  settings,
}: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const totalClaims = outcomes?.length || 0;
  if (totalClaims === 0) {
    return { score: 0 };
  }

  const justifiedClaims = outcomes.filter(v => v.outcome === 'yes');
  const score = justifiedClaims.length / totalClaims;

  return { score: roundToTwoDecimals(score * settings.scale) };
}
