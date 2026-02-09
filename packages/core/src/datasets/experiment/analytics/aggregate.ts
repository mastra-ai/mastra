/**
 * Experiment Analytics Aggregation Helpers
 *
 * Pure functions for computing statistics from raw score data.
 * Used by compareExperiments to build ScorerStats and detect regressions.
 */

import type { ScoreRowData } from '../../../evals/types';
import type { ScorerStats } from './types';

/**
 * Compute the arithmetic mean of an array of numbers.
 *
 * @param values - Array of numbers to average
 * @returns Mean value, or 0 if array is empty
 */
export function computeMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Compute aggregate statistics for a set of scores.
 *
 * Metrics:
 * - errorRate: proportion of items with null scores (errors)
 * - passRate: proportion of scored items meeting threshold
 * - avgScore: mean of non-null scores
 *
 * @param scores - Score records from storage
 * @param passThreshold - Absolute threshold for pass (score >= threshold)
 * @returns ScorerStats with all computed metrics
 */
export function computeScorerStats(scores: ScoreRowData[], passThreshold: number = 0.5): ScorerStats {
  const totalItems = scores.length;

  if (totalItems === 0) {
    return {
      errorRate: 0,
      errorCount: 0,
      passRate: 0,
      passCount: 0,
      avgScore: 0,
      scoreCount: 0,
      totalItems: 0,
    };
  }

  // Separate null scores (errors) from valid scores
  const validScores: number[] = [];
  let errorCount = 0;

  for (const score of scores) {
    if (score.score === null || score.score === undefined) {
      errorCount++;
    } else {
      validScores.push(score.score);
    }
  }

  const scoreCount = validScores.length;
  const errorRate = errorCount / totalItems;

  // Pass rate is computed over items with valid scores only
  const passCount = validScores.filter(s => s >= passThreshold).length;
  const passRate = scoreCount > 0 ? passCount / scoreCount : 0;

  // Average score excludes errors
  const avgScore = computeMean(validScores);

  return {
    errorRate,
    errorCount,
    passRate,
    passCount,
    avgScore,
    scoreCount,
    totalItems,
  };
}

/**
 * Determine if a score delta represents a regression.
 *
 * @param delta - Score difference (experiment B - experiment A)
 * @param threshold - Absolute threshold for regression detection
 * @param direction - Score direction ('higher-is-better' or 'lower-is-better')
 * @returns True if delta represents a regression
 *
 * @example
 * // Higher is better (default): negative delta is bad
 * isRegression(-0.1, 0.05, 'higher-is-better') // true (dropped more than 0.05)
 * isRegression(-0.01, 0.05, 'higher-is-better') // false (within tolerance)
 *
 * // Lower is better: positive delta is bad
 * isRegression(0.1, 0.05, 'lower-is-better') // true (increased more than 0.05)
 */
export function isRegression(
  delta: number,
  threshold: number,
  direction: 'higher-is-better' | 'lower-is-better' = 'higher-is-better',
): boolean {
  if (direction === 'higher-is-better') {
    // Regression if score dropped below threshold
    // delta < -threshold means score dropped by more than threshold
    return delta < -threshold;
  } else {
    // Regression if score increased above threshold
    // delta > threshold means score increased by more than threshold
    return delta > threshold;
  }
}
