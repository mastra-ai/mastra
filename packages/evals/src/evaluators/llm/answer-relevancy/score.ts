import { roundToTwoDecimals } from '../../scoring/utils';
import type { LLMEvaluatorScorerArgs, LLMEvaluatorScoreResult } from '../types';

export function calculateAnswerRelevancyScore({ outcomes, settings }: LLMEvaluatorScorerArgs): LLMEvaluatorScoreResult {
  const numberOfOutcomes = outcomes?.length || 0;
  if (numberOfOutcomes === 0) {
    return { score: 1 };
  }

  let relevancyCount = 0;
  for (const { outcome } of outcomes) {
    if (outcome.trim().toLowerCase() === 'yes') {
      relevancyCount++;
    } else if (outcome.trim().toLowerCase() === 'unsure') {
      relevancyCount += settings.uncertaintyWeight ?? 0;
    }
  }

  const score = relevancyCount / numberOfOutcomes;
  return { score: roundToTwoDecimals(score * settings.scale) };
}
