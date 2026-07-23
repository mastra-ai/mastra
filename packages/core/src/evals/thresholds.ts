import { MastraError } from '../error';

/** Threshold configuration: a number implies minimum, or an object with min/max bounds. */
export type ThresholdConfig = number | { min?: number; max?: number };

/** A scorer reference with an associated pass/fail threshold. */
export type ScorerWithThreshold<TScorer> = {
  scorer: TScorer;
  /** A number implies minimum threshold. Use { min, max } for range-based checks. */
  threshold: ThresholdConfig;
};

/** A scorer entry: either a bare scorer reference or one with a threshold. */
export type ScorerEntry<TScorer> = TScorer | ScorerWithThreshold<TScorer>;

export function checkThresholdPassed(score: number, threshold: ThresholdConfig): boolean {
  if (typeof threshold === 'number') {
    return score >= threshold;
  }
  if (threshold.min !== undefined && score < threshold.min) return false;
  if (threshold.max !== undefined && score > threshold.max) return false;
  return true;
}

export function isScorerWithThreshold<TScorer>(entry: ScorerEntry<TScorer>): entry is ScorerWithThreshold<TScorer> {
  return typeof entry === 'object' && entry !== null && 'scorer' in entry && 'threshold' in entry;
}

function validateThresholdBound(value: number, label: string, scorerId: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_SCORER_THRESHOLD',
      category: 'USER',
      text: `${label} threshold for scorer "${scorerId}" must be a finite number between 0 and 1, got ${value}`,
    });
  }
}

export function validateThresholdConfig(threshold: ThresholdConfig, scorerId: string): void {
  if (typeof threshold === 'number') {
    validateThresholdBound(threshold, 'Minimum', scorerId);
    return;
  }
  if (threshold.min !== undefined) {
    validateThresholdBound(threshold.min, 'Minimum', scorerId);
  }
  if (threshold.max !== undefined) {
    validateThresholdBound(threshold.max, 'Maximum', scorerId);
  }
  if (threshold.min !== undefined && threshold.max !== undefined && threshold.min > threshold.max) {
    throw new MastraError({
      domain: 'SCORER',
      id: 'INVALID_SCORER_THRESHOLD',
      category: 'USER',
      text: `Threshold for scorer "${scorerId}" has min (${threshold.min}) greater than max (${threshold.max})`,
    });
  }
}
