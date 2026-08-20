/**
 * One value per day for the headline sparklines.
 *
 * Rates are read over the trailing week rather than the day itself: a daily
 * median over two completions is noise, and a day with nothing to divide is
 * `null` — a sparkline that plots it as zero says the factory shipped
 * instantly, which is the opposite of what happened.
 */

import { isAgentActor } from '../base.js';
import type { WorkItemRow } from '../base.js';
import type { Window } from './base.js';
import { DAY_MS, DONE_STAGE, isPipelineStage, parseTime, percentile, sentBackAt, share } from './base.js';

const TRAILING_MS = 7 * DAY_MS;
const HOUR_MS = 3_600_000;

export interface FactorySeries {
  /** Trailing-week median lead time, in hours. */
  leadTimeHours: (number | null)[];
  /** Trailing-week share of first stage passes an agent finished. */
  agentCoveragePercent: (number | null)[];
  /** Trailing-week share of the cards pulled in that were sent back. */
  reworkPercent: (number | null)[];
}

/** Stamped samples in ascending order — the shape every trailing-week read walks. */
interface Samples<T> {
  stamps: number[];
  values: T[];
}

function ascending<T>(samples: { at: number; value: T }[]): Samples<T> {
  samples.sort((a, b) => a.at - b.at);
  return { stamps: samples.map(s => s.at), values: samples.map(s => s.value) };
}

/**
 * Values stamped in `(instant - week, instant]` for each instant, walked once.
 * Both bounds only ever move forward, so the whole series costs one pass.
 */
function trailingWeek<T>({ stamps, values }: Samples<T>, instants: number[]): T[][] {
  let lo = 0;
  let hi = 0;
  return instants.map(instant => {
    while (lo < stamps.length && stamps[lo]! <= instant - TRAILING_MS) lo += 1;
    while (hi < stamps.length && stamps[hi]! <= instant) hi += 1;
    return values.slice(lo, hi);
  });
}

function leadSamples(items: WorkItemRow[]): Samples<number> {
  const samples: { at: number; value: number }[] = [];
  for (const item of items) {
    for (const entry of item.stageHistory) {
      if (entry.stage !== DONE_STAGE) continue;
      const doneAt = parseTime(entry.enteredAt);
      samples.push({ at: doneAt, value: Math.max(0, doneAt - item.createdAt.getTime()) });
    }
  }
  return ascending(samples);
}

/** First visits that ended, stamped at the exit — the same passes the headline counts. */
function passSamples(items: WorkItemRow[]): Samples<boolean> {
  const samples: { at: number; value: boolean }[] = [];
  for (const item of items) {
    const visited = new Set<string>();
    for (const entry of item.stageHistory) {
      if (!isPipelineStage(entry.stage) || visited.has(entry.stage)) continue;
      visited.add(entry.stage);
      if (entry.exitedAt === undefined) continue;
      samples.push({ at: parseTime(entry.exitedAt), value: isAgentActor(entry.exitedBy) });
    }
  }
  return ascending(samples);
}

/** Cards stamped when they entered the pipeline, flagged if they were sent back. */
function cohortSamples(items: WorkItemRow[]): Samples<boolean> {
  const samples: { at: number; value: boolean }[] = [];
  for (const item of items) {
    const first = item.stageHistory.find(entry => isPipelineStage(entry.stage));
    if (!first) continue;
    samples.push({ at: parseTime(first.enteredAt), value: sentBackAt(item) !== -1 });
  }
  return ascending(samples);
}

const shareOfTrue = (flags: boolean[]): number | null => share(flags.filter(Boolean).length, flags.length);

export function dailySeries(items: WorkItemRow[], days: string[], { windowEnd }: Window): FactorySeries {
  const instants = days.map(day => Math.min(Date.parse(`${day}T00:00:00Z`) + DAY_MS, windowEnd));
  return {
    leadTimeHours: trailingWeek(leadSamples(items), instants).map(leads => {
      const median = percentile(leads, 0.5);
      return median === null ? null : Math.round((median / HOUR_MS) * 10) / 10;
    }),
    agentCoveragePercent: trailingWeek(passSamples(items), instants).map(shareOfTrue),
    reworkPercent: trailingWeek(cohortSamples(items), instants).map(shareOfTrue),
  };
}
