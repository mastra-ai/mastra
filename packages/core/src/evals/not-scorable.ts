/**
 * Sentinel returned from a scorer step (typically `preprocess`) when the run
 * has nothing for this scorer to evaluate. The pipeline stops, no score is
 * stored, and the run is left out of that scorer's averages.
 */

const NOT_SCORABLE = Symbol.for('mastra.scorer.notScorable');

export interface NotScorableResult {
  [NOT_SCORABLE]: true;
  /** Why the run was not scorable (surfaced on the run result and span). */
  reason?: string;
}

/** How a not-scorable run surfaces on a `ScorerRunResult`. */
export interface NotScorableOutcome {
  reason?: string;
}

/** Marks the current scorer run as not scorable. Return this from a scorer step. */
export function notScorable(reason?: string): NotScorableResult {
  return { [NOT_SCORABLE]: true, ...(reason !== undefined ? { reason } : {}) };
}

export function isNotScorable(value: unknown): value is NotScorableResult {
  return typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[NOT_SCORABLE] === true;
}
