import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

/**
 * Calculates a context relevancy score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateContextRelevancyScore({
  outcomes,
  settings,
}: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const totalOutcomes = outcomes?.length || 0;
  if (totalOutcomes === 0) {
    return { score: 0 };
  }

  const relevantOutcomes = outcomes.filter(v => v.outcome.toLowerCase() === 'yes');
  const score = relevantOutcomes.length / totalOutcomes;

  return { score: roundToTwoDecimals(score * settings.scale) };
}
