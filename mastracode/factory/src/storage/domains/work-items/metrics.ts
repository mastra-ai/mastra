/**
 * Aggregation math for the Factory Metrics page.
 *
 * Pure functions over `work_items` rows — flow metrics (throughput, cycle
 * time, stage durations, WIP, aging WIP) plus demand mix, all derived from the
 * server-appended `stageHistory` log. Keeping this DB-free makes the math unit
 * testable and lets the route stay a thin shell.
 */

import { isAutomationActor } from './base.js';
import type { WorkItemRow, WorkItemStageEntry } from './base.js';

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
 * completion (feeds throughput/cycle time); `canceled` is a tracked
 * non-completion outcome and feeds neither.
 */
const TERMINAL_STAGES = new Set([DONE_STAGE, CANCELED_STAGE]);

const AGING_WIP_LIMIT = 10;

export interface FactoryMetrics {
  windowDays: number;
  /** Earliest work-item creation time (ISO, window-independent) — the natural
   * lower bound for a date-range control. `null` when the board is empty. */
  earliestItemAt: string | null;
  /** Items reaching `done` per UTC day, gap-filled across the window. */
  throughput: { date: string; count: number }[];
  /** Card creation → `done` duration for items completed in the window. */
  cycleTime: { medianMs: number | null; p90Ms: number | null; samples: number };
  /** Median time spent per stage, over visits that ended inside the window. */
  stageDurations: { stage: string; medianMs: number; samples: number }[];
  /** Current cards per stage (window-independent). */
  wip: { stage: string; count: number }[];
  /** Distinct in-flight cards (at least one non-terminal stage). */
  wipTotal: number;
  /** Oldest in-flight cards by time in their current stage. */
  agingWip: { id: string; title: string; stage: string; enteredAt: string; url: string | null }[];
  /** Cards created in the window, by source. */
  sourceMix: { source: string; count: number }[];
  /** Stage moves in the window: human-performed vs total. */
  transitions: { human: number; total: number };
  /** Per-stage automation over completed visits that exited in the window. */
  stageAutomation: {
    stage: string;
    /** Completed visits (entered+exited) to this stage that exited in the window. */
    exits: number;
    /**
     * Of those: clean automated passes — the item's first visit to the stage,
     * entered *and* exited by an automation actor. Missing `exitedBy` (entries
     * written before exit stamping) counts as human.
     */
    automated: number;
    /**
     * Outcomes of the automated passes' items, mutually exclusive, first match
     * wins: `reworked` (a later visit to the same stage exists — deliberately
     * outranks `done`: an automated pass that needed a redo is an automation
     * failure even if the item eventually merged), then `done`, then
     * `canceled`, then `inFlight`.
     */
    outcomes: { done: number; canceled: number; reworked: number; inFlight: number };
  }[];
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRangeParam(value: unknown, boundary: 'from' | 'to'): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return boundary === 'to' && DATE_ONLY_RE.test(value) ? time + DAY_MS : time;
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

function parseTime(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
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

/**
 * The item's completion time: the `enteredAt` of its still-open `done` entry.
 * `undefined` when the item isn't currently done (including when it was pulled
 * back out of done — that visit has `exitedAt` and doesn't count).
 */
function completedAt(item: WorkItemRow): number | undefined {
  if (!item.stages.includes(DONE_STAGE)) return undefined;
  for (let i = item.stageHistory.length - 1; i >= 0; i--) {
    const entry = item.stageHistory[i]!;
    if (entry.stage === DONE_STAGE && entry.exitedAt === undefined) return parseTime(entry.enteredAt);
  }
  return undefined;
}

/** Open (no `exitedAt`) history entry for a currently-held non-terminal stage. */
function openEntries(item: WorkItemRow): WorkItemStageEntry[] {
  return item.stageHistory.filter(
    entry => entry.exitedAt === undefined && !TERMINAL_STAGES.has(entry.stage) && item.stages.includes(entry.stage),
  );
}

export function computeFactoryMetrics(
  items: WorkItemRow[],
  opts: { windowStart: number; windowEnd: number },
): FactoryMetrics {
  const { windowStart, windowEnd } = opts;

  // Earliest creation across all items (window-independent) — the range lower bound.
  let earliest = Infinity;
  for (const item of items) earliest = Math.min(earliest, item.createdAt.getTime());
  const earliestItemAt = Number.isFinite(earliest) ? new Date(earliest).toISOString() : null;

  // ── Throughput + cycle time (completed in window) ─────────────────────────
  // Gap-fill every UTC calendar date intersecting the half-open window.
  const throughputByDay = new Map<string, number>();
  const firstDay = utcDayStart(windowStart);
  for (let day = firstDay; day < windowEnd; day += DAY_MS) {
    throughputByDay.set(utcDay(day), 0);
  }
  const cycleSamples: number[] = [];
  for (const item of items) {
    const doneAt = completedAt(item);
    if (doneAt === undefined || doneAt < windowStart || doneAt >= windowEnd) continue;
    const day = utcDay(doneAt);
    throughputByDay.set(day, (throughputByDay.get(day) ?? 0) + 1);
    cycleSamples.push(Math.max(0, doneAt - item.createdAt.getTime()));
  }

  // ── Stage durations (visits that ended in window) ─────────────────────────
  const durationsByStage = new Map<string, number[]>();
  for (const item of items) {
    for (const entry of item.stageHistory) {
      if (entry.exitedAt === undefined || TERMINAL_STAGES.has(entry.stage)) continue;
      const exited = parseTime(entry.exitedAt);
      if (exited < windowStart || exited >= windowEnd) continue;
      const duration = Math.max(0, exited - parseTime(entry.enteredAt));
      const samples = durationsByStage.get(entry.stage) ?? [];
      samples.push(duration);
      durationsByStage.set(entry.stage, samples);
    }
  }

  // ── Current WIP + aging (window-independent) ──────────────────────────────
  const wipByStage = new Map<string, number>();
  let wipTotal = 0;
  const aging: FactoryMetrics['agingWip'] = [];
  for (const item of items) {
    for (const stage of item.stages) {
      wipByStage.set(stage, (wipByStage.get(stage) ?? 0) + 1);
    }
    const inFlightStages = item.stages.filter(stage => !TERMINAL_STAGES.has(stage));
    if (inFlightStages.length === 0) continue;
    wipTotal += 1;
    // Age the card by its longest-held current stage; fall back to creation
    // time if history is missing an open entry (shouldn't happen — history is
    // server-appended).
    const open = openEntries(item);
    const oldest = open.reduce<WorkItemStageEntry | undefined>(
      (best, entry) => (!best || parseTime(entry.enteredAt) < parseTime(best.enteredAt) ? entry : best),
      undefined,
    );
    aging.push({
      id: item.id,
      title: item.title,
      stage: oldest?.stage ?? inFlightStages[0]!,
      enteredAt: oldest?.enteredAt ?? item.createdAt.toISOString(),
      url: item.externalSource?.url ?? null,
    });
  }
  aging.sort((a, b) => parseTime(a.enteredAt) - parseTime(b.enteredAt));

  // ── Demand mix + transitions (window) ─────────────────────────────────────
  const sourceCounts = new Map<string, number>();
  let transitionsTotal = 0;
  let transitionsHuman = 0;
  for (const item of items) {
    if (item.createdAt.getTime() >= windowStart && item.createdAt.getTime() < windowEnd) {
      const source = item.externalSource
        ? `${item.externalSource.integrationId}:${item.externalSource.type}`
        : 'manual';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    for (const entry of item.stageHistory) {
      const entered = parseTime(entry.enteredAt);
      if (entered < windowStart || entered >= windowEnd) continue;
      transitionsTotal += 1;
      if (!isAutomationActor(entry.by)) transitionsHuman += 1;
    }
  }

  // ── Per-stage automation (completed visits that exited in window) ─────────
  // Rows appear in insertion order of each stage's first counted exit;
  // terminal stages never get rows (they have no meaningful "pass through").
  const automationByStage = new Map<string, FactoryMetrics['stageAutomation'][number]>();
  for (const item of items) {
    const itemDone = completedAt(item) !== undefined;
    const itemCanceled = item.stages.includes(CANCELED_STAGE);
    for (let i = 0; i < item.stageHistory.length; i++) {
      const entry = item.stageHistory[i]!;
      if (entry.exitedAt === undefined || TERMINAL_STAGES.has(entry.stage)) continue;
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
      // A clean automated pass: automation entered AND exited it, and this is
      // the item's first visit to the stage (a re-run is rework, not clean
      // automation). Missing `exitedBy` → human-exited → not automated.
      const firstVisitIndex = item.stageHistory.findIndex(e => e.stage === entry.stage);
      if (firstVisitIndex !== i || !isAutomationActor(entry.by) || !isAutomationActor(entry.exitedBy)) continue;
      row.automated += 1;
      const reworked = item.stageHistory.some((e, j) => j > i && e.stage === entry.stage);
      if (reworked) row.outcomes.reworked += 1;
      else if (itemDone) row.outcomes.done += 1;
      else if (itemCanceled) row.outcomes.canceled += 1;
      else row.outcomes.inFlight += 1;
    }
  }

  return {
    windowDays: throughputByDay.size,
    earliestItemAt,
    throughput: [...throughputByDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    cycleTime: {
      medianMs: percentile(cycleSamples, 0.5),
      p90Ms: percentile(cycleSamples, 0.9),
      samples: cycleSamples.length,
    },
    stageDurations: [...durationsByStage.entries()].map(([stage, samples]) => ({
      stage,
      medianMs: percentile(samples, 0.5)!,
      samples: samples.length,
    })),
    wip: [...wipByStage.entries()].map(([stage, count]) => ({ stage, count })),
    wipTotal,
    agingWip: aging.slice(0, AGING_WIP_LIMIT),
    sourceMix: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    transitions: { human: transitionsHuman, total: transitionsTotal },
    stageAutomation: [...automationByStage.values()],
  };
}
