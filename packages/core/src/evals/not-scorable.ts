/**
 * First-class "not scorable" outcome for scorer runs.
 *
 * A scorer step (typically `preprocess`) returns `notScorable(reason)` when the
 * run contains nothing for this scorer to evaluate — e.g. a tool-call judge on a
 * run that never called the tool. The scorer pipeline then stops before any
 * remaining steps (no judge model calls), no score is recorded, and the run is
 * excluded from the scorer's aggregates instead of counting as a vacuous pass.
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
