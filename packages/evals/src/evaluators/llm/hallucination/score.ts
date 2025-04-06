import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

/**
 * Calculates a hallucination score based on outcomes
 * @param param0 The outcomes, scale, and uncertainty weight
 * @returns A score between 0 and scale
 */
export function calculateScore({ outcomes, settings }: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const totalStatements = outcomes.length;
  const contradictedStatements = outcomes.filter(v => v.outcome === 'yes').length;

  if (totalStatements === 0) {
    return { score: 0 };
  }

  const score = (contradictedStatements / totalStatements) * settings.scale;

  return { score: roundToTwoDecimals(score) };
}
