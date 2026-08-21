/**
 * Pure decision layer for "should the curator run now?".
 *
 * Deliberately free of storage and model access: the caller does the one bounded query and
 * hands the answer in, so this module stays unit-testable in isolation and cheap to call at
 * every lifecycle site.
 *
 * The shape of the decision is `threshold met OR (age exceeded AND newRecordCount >= 1)`:
 *
 * - **Volume** fires regardless of age.
 * - **Age** never fires on its own. An idle resource whose cursor has simply gotten old has
 *   nothing to curate; calling the curator there would not advance the cursor, and the
 *   no-progress backoff would then throttle the resource into silence while burning model
 *   calls. Age is an *opportunistic* threshold consulted when the lifecycle is already
 *   evaluating — never a timer, never scheduled.
 * - **No cursor** (nothing has ever been curated for this source) means there is no age
 *   baseline to measure against, so the age arm cannot apply and the predicate fires on the
 *   volume condition only.
 */

/** Which condition caused the curator to be triggered, or `null` when it should not run. */
export type CurationTriggerReason = 'threshold' | 'age' | null;

export interface CurationTriggerConfig {
  curationThreshold: number | false;
  curationMaxAgeMs: number | false;
}

export interface CurationTriggerCursor {
  updatedAt: Date;
}

export interface CurationTriggerInput {
  config: CurationTriggerConfig;
  /** The current curation cursor, or `null`/`undefined` when nothing has been curated yet. */
  cursor: CurationTriggerCursor | null | undefined;
  /** How many uncurated records the caller's bounded query found (capped by its limit). */
  newRecordCount: number;
  /** Injected clock, in epoch milliseconds. */
  now: number;
}

/**
 * How many records the caller should ask for when answering {@link shouldCurate}.
 *
 * With a threshold configured, the query only ever needs to distinguish "fewer than the
 * threshold" from "at least the threshold", so the threshold itself is the limit. With only
 * the age condition configured, the query only needs to know whether *any* uncurated record
 * exists, so a limit of 1 is enough. Returns `0` when both conditions are off — the caller
 * should skip the query entirely.
 */
export function curationQueryLimit(config: CurationTriggerConfig): number {
  const { curationThreshold, curationMaxAgeMs } = config;
  if (typeof curationThreshold === 'number') return curationThreshold;
  if (typeof curationMaxAgeMs === 'number') return 1;
  return 0;
}

/** Returns the condition that fired, or `null` when the curator should not run. */
export function shouldCurate({ config, cursor, newRecordCount, now }: CurationTriggerInput): CurationTriggerReason {
  const { curationThreshold, curationMaxAgeMs } = config;

  if (typeof curationThreshold === 'number' && newRecordCount >= curationThreshold) {
    return 'threshold';
  }

  if (typeof curationMaxAgeMs === 'number' && newRecordCount >= 1 && cursor) {
    if (now - cursor.updatedAt.getTime() >= curationMaxAgeMs) {
      return 'age';
    }
  }

  return null;
}
