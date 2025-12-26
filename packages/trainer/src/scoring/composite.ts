import type { ScorerResult, CompositeConfig } from '../types';

/**
 * Compute a weighted composite score from multiple scorer results.
 *
 * @param results - Array of scorer results
 * @param config - Composite configuration with weights
 * @returns Normalized composite score (0-1)
 */
export function computeCompositeScore(results: ScorerResult[], config: CompositeConfig): number {
  const { weights } = config;

  // Get total weight for normalization
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return 0;
  }

  // Compute weighted sum
  let weightedSum = 0;
  let appliedWeight = 0;

  for (const result of results) {
    const weight = weights[result.scorerId];
    if (weight !== undefined && weight > 0) {
      // Clamp score to 0-1 range
      const score = Math.max(0, Math.min(1, result.score));
      weightedSum += score * weight;
      appliedWeight += weight;
    }
  }

  // If no weights were applied, return 0
  if (appliedWeight === 0) {
    return 0;
  }

  // Normalize by applied weight (not total, to handle missing scorers gracefully)
  return weightedSum / appliedWeight;
}

/**
 * Create a composite config from a simple weight map.
 */
export function createCompositeConfig(weights: Record<string, number>): CompositeConfig {
  return { weights };
}

/**
 * Validate that all required scorers are present in results.
 */
export function validateScorerCoverage(
  results: ScorerResult[],
  config: CompositeConfig,
): { valid: boolean; missing: string[] } {
  const resultIds = new Set(results.map(r => r.scorerId));
  const missing: string[] = [];

  for (const [scorerId, weight] of Object.entries(config.weights)) {
    if (weight > 0 && !resultIds.has(scorerId)) {
      missing.push(scorerId);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
