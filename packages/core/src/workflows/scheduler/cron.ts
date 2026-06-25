import { Cron } from 'croner';

/**
 * Validate a cron expression. Throws if the pattern is invalid.
 *
 * @param cron - Cron expression (5-, 6-, or 7-part).
 * @param timezone - Optional IANA timezone (e.g. 'America/New_York').
 */
export function validateCron(cron: string, timezone?: string): void {
  if (typeof cron !== 'string' || cron.trim() === '') {
    throw new Error(
      `Invalid cron expression: expected a non-empty cron string (e.g. "0 * * * *"), but received ${cron === undefined ? 'undefined' : JSON.stringify(cron)}.`,
    );
  }
  // Croner throws synchronously on invalid patterns. To also validate the
  // timezone (which croner only checks lazily), compute the next run.
  try {
    const job = new Cron(cron, { timezone });
    job.nextRun();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid cron expression "${cron}": ${reason}`);
  }
}

/**
 * Compute the next fire time (ms since epoch) for a cron expression.
 *
 * @param cron - Cron expression.
 * @param options - Optional timezone and reference time (`after`, ms since epoch).
 *   The next fire time is the first cron occurrence strictly after `after`.
 *   Defaults to `Date.now()`.
 * @returns The next fire time in ms since epoch.
 * @throws If the cron expression is invalid or has no future occurrence.
 */
export function computeNextFireAt(cron: string, options?: { timezone?: string; after?: number }): number {
  const job = new Cron(cron, { timezone: options?.timezone });
  const reference = options?.after !== undefined ? new Date(options.after) : new Date();
  const next = job.nextRun(reference);
  if (!next) {
    throw new Error(`Cron expression "${cron}" has no future occurrence after ${reference.toISOString()}`);
  }
  return next.getTime();
}
