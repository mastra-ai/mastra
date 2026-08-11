/**
 * Aggregation math for the Factory Overview page.
 *
 * Pure functions over `work_items` rows — throughput, lead time, in-flight
 * count, demand mix and per-stage automation, all read from the server-appended
 * `stageHistory` log. Keeping this DB-free makes the math unit testable and lets
 * the route stay a thin shell.
 *
 * Everything windowed is counted as an event that happened inside the window,
 * never as "the state the board happens to be in now", so re-querying a past
 * window always returns the same numbers.
 */

import { isAutomationActor } from './base.js';
import type { WorkItemRow } from './base.js';

/** Default window span (days) when the request omits or malforms the range. */
export const DEFAULT_METRICS_WINDOW = 30;
/** Hard cap on the range span (days) — bounds the gap-filled throughput array. */
export const MAX_METRICS_WINDOW = 366;

const DAY_MS = 86_400_000;

/** Terminal stage — items here count as completed, not in-flight. */
const DONE_STAGE = 'done';

/** Terminal stage for tracked non-completions — never a completion. */
const CANCELED_STAGE = 'canceled';

/**
 * Terminal stages — items holding only these are not in-flight. `done` is a
 * completion (feeds throughput/lead time); `canceled` is a tracked
 * non-completion outcome and feeds neither.
 */
const TERMINAL_STAGES = new Set([DONE_STAGE, CANCELED_STAGE]);

export interface FactoryMetrics {
  /**
   * Days the series covers: the requested window clipped to the board's life.
   * Days before the first card could hold no completion, so counting them would
   * drag the per-day rate toward zero on a young board.
   */
  daysCovered: number;
  /** Entries into `done` per UTC day, gap-filled across the covered days. */
  throughput: { date: string; count: number }[];
  /** Card creation → `done` for every completion that landed in the window. */
  leadTime: { medianMs: number | null; p90Ms: number | null; samples: number };
  /** Distinct in-flight cards (at least one non-terminal stage). */
  wipTotal: number;
  /** Cards created in the window, by source. */
  sourceMix: { source: string; count: number }[];
  /** Stage moves in the window, card creation excluded: human-performed vs total. */
  transitions: { human: number; total: number };
  /** Per-stage automation over first visits that ended in the window. */
  stageAutomation: {
    stage: string;
    /**
     * First visits to this stage that ended in the window. Repeat visits are
     * excluded from both sides: they are rework, already reported as such, and
     * counting them in the denominator alone caps a fully automated stage below
     * 100%.
     */
    exits: number;
    /**
     * Of those: passes entered *and* exited by an automation actor. Missing
     * `exitedBy` (entries written before exit stamping) counts as human.
     */
    automated: number;
    /**
     * Outcomes of the automated passes' items as of the window's end, mutually
     * exclusive, first match wins: `reworked` (a later visit to the same stage
     * — deliberately outranks `done`: a pass that needed a redo is an
     * automation failure even if the item eventually merged), then `done`, then
     * `canceled`, then `inFlight`.
     */
    outcomes: { done: number; canceled: number; reworked: number; inFlight: number };
  }[];
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Datetime carrying an explicit `Z` or `±HH:MM` offset. */
const ZONED_DATETIME_RE = /(?:[Zz]|[+-]\d{2}:?\d{2})$/;

function parseRangeParam(value: unknown, boundary: 'from' | 'to'): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const dateOnly = DATE_ONLY_RE.test(value);
  // Timezone-less datetimes are parsed as server-local by Date.parse, so the
  // window would shift by deployment region — reject them as invalid.
  if (!dateOnly && !ZONED_DATETIME_RE.test(value)) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return boundary === 'to' && dateOnly ? time + DAY_MS : time;
}

function utcDayStart(time: number): number {
  return Date.parse(`${utcDay(time)}T00:00:00Z`);
}

/**
 * Resolve untrusted `from`/`to` into a bounded half-open UTC window. A date-only
 * `to` covers the whole day; an open/future end resolves to the end of the
 * current UTC day (not `now`) so an event at this instant stays inside the
 * window instead of on its excluded edge.
 */
export function parseMetricsRange(
  fromParam: unknown,
  toParam: unknown,
  now: Date,
): { windowStart: number; windowEnd: number } {
  const nowMs = now.getTime();
  const endOfToday = utcDayStart(nowMs) + DAY_MS;
  const requestedEnd = parseRangeParam(toParam, 'to') ?? endOfToday;
  const windowEnd = Math.min(requestedEnd, endOfToday);
  const lastIncludedDay = utcDayStart(windowEnd - 1);
  const defaultStart = lastIncludedDay - (DEFAULT_METRICS_WINDOW - 1) * DAY_MS;
  const parsedFrom = parseRangeParam(fromParam, 'from');
  let windowStart = parsedFrom !== undefined && parsedFrom < windowEnd ? parsedFrom : defaultStart;
  const earliestStart = lastIncludedDay - (MAX_METRICS_WINDOW - 1) * DAY_MS;
  if (windowStart < earliestStart) windowStart = earliestStart;
  return { windowStart, windowEnd };
}

/** Stage history is server-appended, so an unparsable stamp is a corrupt row. */
function parseTime(iso: string): number {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) throw new Error(`Unparsable stage-history timestamp: ${iso}`);
  return time;
}

/** Asserted up front so a corrupt row fails every window, not just the ones that read it. */
function assertParsableHistory(items: WorkItemRow[]): void {
  for (const item of items) {
    for (const entry of item.stageHistory) {
      parseTime(entry.enteredAt);
      if (entry.exitedAt !== undefined) parseTime(entry.exitedAt);
    }
  }
}

/** Nearest-rank percentile over an unsorted sample list. */
function percentile(samples: number[], fraction: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(fraction * sorted.length));
  return sorted[rank - 1]!;
}

/** UTC `YYYY-MM-DD` for a timestamp. */
function utcDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Stages the item was holding at `time`, replayed from its history. */
function stagesHeldAt(item: WorkItemRow, time: number): Set<string> {
  const held = new Set<string>();
  for (const entry of item.stageHistory) {
    if (parseTime(entry.enteredAt) >= time) continue;
    if (entry.exitedAt !== undefined && parseTime(entry.exitedAt) <= time) continue;
    held.add(entry.stage);
  }
  return held;
}

export function computeFactoryMetrics(
  items: WorkItemRow[],
  opts: { windowStart: number; windowEnd: number },
): FactoryMetrics {
  const { windowStart, windowEnd } = opts;
  assertParsableHistory(items);

  // ── Throughput + lead time (completions in window) ────────────────────────
  let earliestItem = Infinity;
  for (const item of items) earliestItem = Math.min(earliestItem, item.createdAt.getTime());
  const boardStart = Number.isFinite(earliestItem) ? utcDayStart(earliestItem) : -Infinity;
  const firstDay = Math.max(utcDayStart(windowStart), boardStart);

  const throughputByDay = new Map<string, number>();
  for (let day = firstDay; day < windowEnd; day += DAY_MS) {
    throughputByDay.set(utcDay(day), 0);
  }
  // A completion is an entry *into* `done`, not the state of the card now: a
  // card reopened today must not erase the day it shipped, and a card that
  // shipped twice shipped twice.
  const leadSamples: number[] = [];
  for (const item of items) {
    for (const entry of item.stageHistory) {
      if (entry.stage !== DONE_STAGE) continue;
      const doneAt = parseTime(entry.enteredAt);
      if (doneAt < windowStart || doneAt >= windowEnd) continue;
      const day = utcDay(doneAt);
      throughputByDay.set(day, (throughputByDay.get(day) ?? 0) + 1);
      leadSamples.push(Math.max(0, doneAt - item.createdAt.getTime()));
    }
  }

  // ── Current in-flight count (window-independent) ──────────────────────────
  let wipTotal = 0;
  for (const item of items) {
    if (item.stages.some(stage => !TERMINAL_STAGES.has(stage))) wipTotal += 1;
  }

  // ── Demand mix + transitions (window) ─────────────────────────────────────
  const sourceCounts = new Map<string, number>();
  let transitionsTotal = 0;
  let transitionsHuman = 0;
  for (const item of items) {
    const created = item.createdAt.getTime();
    if (created >= windowStart && created < windowEnd) {
      const source = item.externalSource
        ? `${item.externalSource.integrationId}:${item.externalSource.type}`
        : 'manual';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    // The first entry is where the card landed on creation, not a move —
    // counting it credits every webhook-synced card as an automated transition.
    for (let i = 1; i < item.stageHistory.length; i++) {
      const entry = item.stageHistory[i]!;
      const entered = parseTime(entry.enteredAt);
      if (entered < windowStart || entered >= windowEnd) continue;
      transitionsTotal += 1;
      if (!isAutomationActor(entry.by)) transitionsHuman += 1;
    }
  }

  // ── Per-stage automation (first visits that exited in window) ─────────────
  // Rows appear in insertion order of each stage's first counted exit;
  // terminal stages never get rows (they have no meaningful "pass through").
  const automationByStage = new Map<string, FactoryMetrics['stageAutomation'][number]>();
  for (const item of items) {
    const heldAtWindowEnd = stagesHeldAt(item, windowEnd);
    const visited = new Set<string>();
    for (let i = 0; i < item.stageHistory.length; i++) {
      const entry = item.stageHistory[i]!;
      if (TERMINAL_STAGES.has(entry.stage) || visited.has(entry.stage)) continue;
      visited.add(entry.stage);
      if (entry.exitedAt === undefined) continue;
      const exited = parseTime(entry.exitedAt);
      if (exited < windowStart || exited >= windowEnd) continue;
      let row = automationByStage.get(entry.stage);
      if (!row) {
        row = {
          stage: entry.stage,
          exits: 0,
          automated: 0,
          outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 },
        };
        automationByStage.set(entry.stage, row);
      }
      row.exits += 1;
      // Missing `exitedBy` → human-exited → not an automated pass.
      if (!isAutomationActor(entry.by) || !isAutomationActor(entry.exitedBy)) continue;
      row.automated += 1;
      const reworked = item.stageHistory.some(
        (later, j) => j > i && later.stage === entry.stage && parseTime(later.enteredAt) < windowEnd,
      );
      if (reworked) row.outcomes.reworked += 1;
      else if (heldAtWindowEnd.has(DONE_STAGE)) row.outcomes.done += 1;
      else if (heldAtWindowEnd.has(CANCELED_STAGE)) row.outcomes.canceled += 1;
      else row.outcomes.inFlight += 1;
    }
  }

  return {
    daysCovered: throughputByDay.size,
    throughput: [...throughputByDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    leadTime: {
      medianMs: percentile(leadSamples, 0.5),
      p90Ms: percentile(leadSamples, 0.9),
      samples: leadSamples.length,
    },
    wipTotal,
    sourceMix: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    transitions: { human: transitionsHuman, total: transitionsTotal },
    stageAutomation: [...automationByStage.values()],
  };
}
