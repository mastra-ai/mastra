/**
 * Durable retry state for curation attempts.
 *
 * A curator run that fails (no model, a provider error, a thrown tool) must not be retried on
 * every single turn: the trigger conditions that fired it are still true, so an unguarded retry
 * loop calls a failing model once per turn forever. Backoff state is therefore persisted on the
 * observational memory record's `config.subconscious.curationAttempt` jsonb, which means it
 * **survives a process restart** — an in-memory counter would forget the backoff and resume
 * hammering the model as soon as the service redeployed.
 *
 * What this does NOT do: it is not an atomic claim. Two live instances sharing the same storage
 * can both read the same attempt state and both decide to run. Closing that requires a
 * conditional write the storage layer does not currently expose — see `README` notes on the
 * curation triggers and the `BLOCKED` finding in the plan.
 */

export const CURATION_BACKOFF_BASE_MS = 60_000;
export const CURATION_BACKOFF_CAP_MS = 60 * 60_000;

export interface CurationAttemptState {
  /** Consecutive failed attempts. Cleared on success. */
  failures: number;
  /** Epoch ms before which no further attempt should be made. */
  nextAttemptAt: number;
}

/** Parses persisted attempt state, tolerating absent or malformed jsonb. */
export function readAttemptState(config: unknown): CurationAttemptState | undefined {
  const attempt = (config as { subconscious?: { curationAttempt?: unknown } } | undefined)?.subconscious
    ?.curationAttempt as Partial<CurationAttemptState> | undefined;
  if (!attempt || typeof attempt.failures !== 'number' || typeof attempt.nextAttemptAt !== 'number') {
    return undefined;
  }
  return { failures: attempt.failures, nextAttemptAt: attempt.nextAttemptAt };
}

/** True when a previous failure's backoff window has not yet elapsed. */
export function isBackingOff(state: CurationAttemptState | undefined, now: number): boolean {
  return Boolean(state && state.failures > 0 && now < state.nextAttemptAt);
}

/**
 * Next state after a failed attempt: exponential from one minute, doubling, capped at one hour.
 */
export function nextBackoff(state: CurationAttemptState | undefined, now: number): CurationAttemptState {
  const failures = (state?.failures ?? 0) + 1;
  const delay = Math.min(CURATION_BACKOFF_BASE_MS * 2 ** (failures - 1), CURATION_BACKOFF_CAP_MS);
  return { failures, nextAttemptAt: now + delay };
}

/** State written after a successful curation: the slate is clean. */
export function clearedBackoff(): CurationAttemptState {
  return { failures: 0, nextAttemptAt: 0 };
}
