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
 */

import type { IMastraLogger } from '../logger';
import type { Workflow } from './workflow';

export interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

/**
 * Parse a single cron field into the set of matching integer values.
 */
function parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

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

      if (range !== '*') {
        if (range!.includes('-')) {
          const [s, e] = range!.split('-');
          start = parseInt(s!, 10);
          end = parseInt(e!, 10);
        } else {
          start = parseInt(range!, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (trimmed === '*') {
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

  return values;
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

  const minutes = parseCronField(parts[0]!, 0, 59);
  const hours = parseCronField(parts[1]!, 0, 23);
  const daysOfMonth = parseCronField(parts[2]!, 1, 31);
  const months = parseCronField(parts[3]!, 1, 12);
  const daysOfWeek = parseCronField(parts[4]!, 0, 7);

  // Normalize: 7 (Sunday) → 0
  if (daysOfWeek.has(7)) {
    daysOfWeek.add(0);
    daysOfWeek.delete(7);
  }

  return { minutes, hours, daysOfMonth, months, daysOfWeek };
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
 * Compute the next Date matching the given cron expression, strictly after `from`.
 * Scans forward efficiently by skipping non-matching months, days, and hours.
 */
export function getNextCronDate(cronExpr: string, from: Date): Date {
  const { minutes, hours, daysOfMonth, months, daysOfWeek } = parseCron(cronExpr);

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

    if (!daysOfMonth.has(date.getDate()) || !daysOfWeek.has(date.getDay())) {
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

  throw new Error(`No matching cron date found within 4 years for: "${cronExpr}"`);
}

/**
 * A lightweight cron scheduler that manages setTimeout-chained execution
 * of workflows with `schedule` configs.
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

    const scheduleNext = () => {
      if (!this.#running) return;

      const now = new Date();
      let next: Date;
      try {
        next = getNextCronDate(cron, now);
      } catch {
        logger?.error?.(`Failed to compute next cron date for workflow "${workflow.id}"`);
        return;
      }

      const delay = next.getTime() - now.getTime();

      const timer = setTimeout(async () => {
        if (!this.#running) return;
        try {
          const run = await workflow.createRun();
          await run.start({ inputData: inputData ?? {} });
        } catch (err) {
          logger?.error?.(`Cron execution failed for workflow "${workflow.id}":`, err);
        }
        scheduleNext();
      }, delay);

      this.#timers.set(workflow.id, timer);
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
