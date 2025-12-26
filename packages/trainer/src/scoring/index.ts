export { computeCompositeScore, createCompositeConfig, validateScorerCoverage } from './composite';

export { applyGates, createGate, formatGateResults } from './gates';

import type { ScorerResult, ScoringConfig, Scorecard, AgentRunRecord } from '../types';
import { computeCompositeScore } from './composite';
import { applyGates } from './gates';

/**
 * Create a full scorecard for a run.
 */
export function createScorecard(run: AgentRunRecord, results: ScorerResult[], config: ScoringConfig): Scorecard {
  const compositeScore = computeCompositeScore(results, { weights: config.composite });

  const { passed: passedGates, gateResults } = config.gates
    ? applyGates(results, config.gates)
    : { passed: true, gateResults: [] };

  return {
    run,
    results,
    compositeScore,
    passedGates,
    gateResults,
  };
}
