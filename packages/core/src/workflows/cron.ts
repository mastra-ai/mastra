/**
 * Minimal cron expression parser and scheduler for native workflow scheduling.
 *
 * Supports standard 5-field cron syntax:
 *   ┌───────────── minute (0-59)
 *   │ ┌───────────── hour (0-23)
 *   │ │ ┌───────────── day of month (1-31)
 *   │ │ │ ┌───────────── month (1-12)
 *   │ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
 *   │ │ │ │ │
 *   * * * * *
 *
 * Each field supports: *, N, N-M, N,M, and /N step values.
 *
 * Day-of-month / day-of-week interaction follows standard cron semantics:
 * when both fields are restricted (not `*`), the match is OR'd — fire if
 * either field matches. When only one is restricted, only that field is checked.
 */

import type { IMastraLogger } from '../logger';
import type { Workflow } from './workflow';

export interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  /** True when the day-of-month field was `*` (or equivalent full range). */
  domWildcard: boolean;
  /** True when the day-of-week field was `*` (or equivalent full range). */
  dowWildcard: boolean;
}

/**
 * Parse a single cron field into the set of matching integer values.
 */
function parseCronField(field: string, min: number, max: number): { values: Set<number>; isWildcard: boolean } {
  const values = new Set<number>();
  let isWildcard = false;

  for (const part of field.split(',')) {
    const trimmed = part.trim();

    if (trimmed.includes('/')) {
      const [range, stepStr] = trimmed.split('/');
      const step = parseInt(stepStr!, 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid cron step value: "${stepStr}"`);
      }

      let start = min;
      let end = max;

      if (range === '*') {
        isWildcard = true;
      } else if (range!.includes('-')) {
        const [s, e] = range!.split('-');
        start = parseInt(s!, 10);
        end = parseInt(e!, 10);
      } else {
        start = parseInt(range!, 10);
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (trimmed === '*') {
      isWildcard = true;
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    } else if (trimmed.includes('-')) {
      const [s, e] = trimmed.split('-');
      const start = parseInt(s!, 10);
      const end = parseInt(e!, 10);
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid cron range: "${trimmed}"`);
      }
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
    } else {
      const val = parseInt(trimmed, 10);
      if (isNaN(val)) {
        throw new Error(`Invalid cron value: "${trimmed}"`);
      }
      values.add(val);
    }
  }

  for (const val of values) {
    if (val < min || val > max) {
      throw new Error(`Cron value ${val} out of range [${min}-${max}]`);
    }
  }

  return { values, isWildcard };
}

/**
 * Parse a 5-field cron expression into its component field sets.
 * Throws if the expression is invalid.
 */
export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression "${expr}": expected 5 fields, got ${parts.length}`);
  }

  const { values: minutes } = parseCronField(parts[0]!, 0, 59);
  const { values: hours } = parseCronField(parts[1]!, 0, 23);
  const { values: daysOfMonth, isWildcard: domWildcard } = parseCronField(parts[2]!, 1, 31);
  const { values: months } = parseCronField(parts[3]!, 1, 12);
  const { values: daysOfWeek, isWildcard: dowWildcard } = parseCronField(parts[4]!, 0, 7);

  // Normalize: 7 (Sunday) → 0
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0);
    daysOfWeek.delete(7);
  }

  return { minutes, hours, daysOfMonth, months, daysOfWeek, domWildcard, dowWildcard };
}

/**
 * Validate a cron expression. Returns true if valid, false otherwise.
 */
export function validateCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a date's day matches the DOM/DOW fields using standard cron
 * semantics: when both fields are restricted, use OR; when only one is
 * restricted, check only that field; when both are wildcards, always match.
 */
function dayMatches(date: Date, fields: CronFields): boolean {
  const domMatch = fields.daysOfMonth.has(date.getDate());
  const dowMatch = fields.daysOfWeek.has(date.getDay());

  if (fields.domWildcard && fields.dowWildcard) {
    // Both wildcards — always matches
    return true;
  }
  if (fields.domWildcard) {
    // Only DOW is restricted
    return dowMatch;
  }
  if (fields.dowWildcard) {
    // Only DOM is restricted
    return domMatch;
  }
  // Both restricted — OR semantics per cron spec
  return domMatch || dowMatch;
}

/**
 * Compute the next Date matching the given cron fields, strictly after `from`.
 * Scans forward efficiently by skipping non-matching months, days, and hours.
 *
 * Accepts either a pre-parsed `CronFields` object or a cron expression string.
 */
export function getNextCronDate(cronOrFields: string | CronFields, from: Date): Date {
  const fields = typeof cronOrFields === 'string' ? parseCron(cronOrFields) : cronOrFields;
  const { minutes, hours, months } = fields;

  // Start from the next whole minute after `from`
  const date = new Date(from.getTime());
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  const maxTime = from.getTime() + 4 * 365.25 * 24 * 60 * 60 * 1000;

  while (date.getTime() <= maxTime) {
    if (!months.has(date.getMonth() + 1)) {
      date.setMonth(date.getMonth() + 1, 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }

    if (!dayMatches(date, fields)) {
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      continue;
    }

    if (!hours.has(date.getHours())) {
      date.setHours(date.getHours() + 1, 0, 0, 0);
      continue;
    }

    if (!minutes.has(date.getMinutes())) {
      date.setMinutes(date.getMinutes() + 1, 0, 0);
      continue;
    }

    return date;
  }

  throw new Error(
    `No matching cron date found within 4 years for: "${typeof cronOrFields === 'string' ? cronOrFields : 'CronFields'}"`,
  );
}

/** Maximum safe delay for setTimeout (2^31 - 1 ms, ~24.8 days). */
const MAX_TIMEOUT_DELAY = 2_147_483_647;

/**
 * A lightweight cron scheduler that manages setTimeout-chained execution
 * of workflows with `schedule` configs.
 *
 * Runs don't overlap — the next execution is scheduled only after the
 * current run completes. If a run takes longer than the cron interval,
 * intermediate fires are silently skipped.
 */
export class CronScheduler {
  #timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  #running = false;

  get running() {
    return this.#running;
  }

  /**
   * Start scheduling all workflows that have a `schedule.cron` config.
   */
  start(workflows: Record<string, Workflow<any, any, any, any, any, any, any>>, logger?: IMastraLogger): void {
    this.#running = true;
    for (const workflow of Object.values(workflows)) {
      const schedule = workflow.schedule;
      if (schedule?.cron) {
        this.#scheduleWorkflow(workflow, logger);
      }
    }
  }

  #scheduleWorkflow(workflow: Workflow<any, any, any, any, any, any, any>, logger?: IMastraLogger): void {
    const { cron, inputData } = workflow.schedule!;
    // Parse once and reuse the fields for every scheduling cycle
    const fields = parseCron(cron);

    const scheduleNext = () => {
      if (!this.#running) return;

      const now = new Date();
      let next: Date;
      try {
        next = getNextCronDate(fields, now);
      } catch {
        logger?.error?.(`Failed to compute next cron date for workflow "${workflow.id}"`);
        return;
      }

      const delay = next.getTime() - now.getTime();

      const executeAndReschedule = async () => {
        if (!this.#running) return;
        try {
          const run = await workflow.createRun();
          await run.start({ inputData: inputData ?? {} });
        } catch (err) {
          logger?.error?.(`Cron execution failed for workflow "${workflow.id}":`, err);
        }
        scheduleNext();
      };

      // Chain intermediate timeouts for delays that exceed Node's 32-bit limit
      if (delay > MAX_TIMEOUT_DELAY) {
        const timer = setTimeout(() => {
          if (!this.#running) return;
          scheduleNext();
        }, MAX_TIMEOUT_DELAY);
        this.#timers.set(workflow.id, timer);
      } else {
        const timer = setTimeout(executeAndReschedule, delay);
        this.#timers.set(workflow.id, timer);
      }
    };

    scheduleNext();
  }

  /**
   * Stop all scheduled cron timers and prevent further scheduling.
   */
  stop(): void {
    this.#running = false;
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
  }
}
