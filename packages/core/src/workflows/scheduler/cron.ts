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
  // Croner throws synchronously on an invalid pattern when the job is
  // constructed. Validate the pattern on its own first so timezone problems
  // (which croner only surfaces lazily) are not mislabeled as cron errors.
  let job: Cron;
  try {
    job = new Cron(cron);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid cron expression "${cron}": ${reason}`);
  }
  // The timezone is only exercised when a fire time is computed.
  if (timezone !== undefined) {
    try {
      new Cron(cron, { timezone }).nextRun();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid timezone "${timezone}": ${reason}`);
    }
  } else {
    job.nextRun();
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

/**
 * Resolve what a schedule claim should write after firing at `after`.
 *
 * - One-off (`runAt` set): keep `nextFireAt` and mark the row `completed`.
 * - Bounded cron (`endAt` set): advance to the next cron occurrence, or mark
 *   `completed` when that occurrence is after `endAt`.
 * - Unbounded cron: advance to the next cron occurrence.
 */
export function computeNextFire(
  schedule: { cron: string; timezone?: string; runAt?: number; endAt?: number; nextFireAt: number },
  after: number,
): { nextFireAt: number; completed: boolean } {
  if (schedule.runAt != null) {
    return { nextFireAt: schedule.nextFireAt, completed: true };
  }
  const nextFireAt = computeNextFireAt(schedule.cron, { timezone: schedule.timezone, after });
  return { nextFireAt, completed: schedule.endAt != null && nextFireAt > schedule.endAt };
}

/**
 * Validate the timing fields of a schedule: exactly one of `cron` or a future
 * `runAt`, `endAt` only alongside `cron` and in the future. Throws on invalid input.
 */
export function validateScheduleTiming(input: {
  cron?: string;
  timezone?: string;
  runAt?: number | Date;
  endAt?: number | Date;
}): void {
  const hasCron = input.cron !== undefined && input.cron !== '';
  const hasRunAt = input.runAt !== undefined;
  if (hasCron === hasRunAt) {
    throw new Error('Schedule must specify exactly one of `cron` or `runAt`.');
  }
  if (hasRunAt) {
    const runAt = toEpochMs(input.runAt!);
    if (!Number.isFinite(runAt)) {
      throw new Error('Schedule `runAt` must be a valid date or ms epoch timestamp.');
    }
    if (runAt <= Date.now()) {
      throw new Error('Schedule `runAt` must be in the future.');
    }
    if (input.endAt !== undefined) {
      throw new Error('Schedule `endAt` is only allowed together with `cron`.');
    }
    return;
  }
  validateCron(input.cron!, input.timezone);
  if (input.endAt !== undefined) {
    const endAt = toEpochMs(input.endAt);
    if (!Number.isFinite(endAt)) {
      throw new Error('Schedule `endAt` must be a valid date or ms epoch timestamp.');
    }
    if (endAt <= Date.now()) {
      throw new Error('Schedule `endAt` must be in the future.');
    }
  }
}

/**
 * Compute the initial row timing for a new schedule. One-offs fire at
 * `runAt`; a bounded cron whose first occurrence is already past `endAt`
 * starts `completed`.
 */
export function computeInitialFire(input: { cron?: string; timezone?: string; runAt?: number; endAt?: number }): {
  nextFireAt: number;
  completed: boolean;
} {
  if (input.runAt !== undefined) {
    return { nextFireAt: input.runAt, completed: false };
  }
  const nextFireAt = computeNextFireAt(input.cron!, { timezone: input.timezone });
  return { nextFireAt, completed: input.endAt !== undefined && nextFireAt > input.endAt };
}

export function toEpochMs(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}
