import { setTimeout as sleep } from 'node:timers/promises';

/** Backoff between failed background split passes. Tests replace `wait` so they don't sleep. */
export const splitBackfillRetry = {
  firstDelayMs: 5_000,
  maxDelayMs: 5 * 60_000,
  /** Resolves after `ms`, or as soon as `signal` aborts. Never holds the process open. */
  async wait(ms: number, signal: AbortSignal): Promise<void> {
    await sleep(ms, undefined, { signal, ref: false }).catch(() => {});
  },
};

/**
 * Runs `backfill` until a pass completes or `signal` aborts, waiting longer after each failure
 * (doubling, capped). Until then uncopied cards are still copied when read.
 */
export async function backfillUntilDone(backfill: () => Promise<unknown>, signal: AbortSignal): Promise<void> {
  for (let attempt = 0; !signal.aborted; attempt += 1) {
    try {
      await backfill();
      return;
    } catch (error) {
      if (signal.aborted) return;
      const delay = Math.min(splitBackfillRetry.firstDelayMs * 2 ** attempt, splitBackfillRetry.maxDelayMs);
      console.warn(
        `[factory] work item split backfill failed: ${error instanceof Error ? error.message : error}; retrying in ${Math.round(delay / 1000)}s`,
      );
      await splitBackfillRetry.wait(delay, signal);
    }
  }
}
