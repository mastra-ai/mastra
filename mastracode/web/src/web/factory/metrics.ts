/**
 * Aggregation math for the Factory Metrics page.
 *
 * Pure functions over `work_items` rows — flow metrics (throughput, cycle
 * time, stage durations, WIP, aging WIP) plus demand mix, all derived from the
 * server-appended `stageHistory` log. Keeping this DB-free makes the math unit
 * testable and lets the route stay a thin shell.
 */

import type { WorkItemRow, WorkItemStageEntry } from '../storage/domains/work-items/base';

/** Default window span (days) when the request omits or malforms the range. */
export const DEFAULT_METRICS_WINDOW = 30;
/** Hard cap on the range span (days) — bounds the gap-filled throughput array. */
export const MAX_METRICS_WINDOW = 366;

const DAY_MS = 86_400_000;

/** Terminal stage — items here count as completed, not in-flight. */
const DONE_STAGE = 'done';

/**
 * Sentinel actor ids for server/automation-driven transitions. Today every
 * stage move is stamped with the acting user's WorkOS id, so `human === total`;
 * if server-side automation ever moves cards under one of these actors the
 * split starts diverging without a schema change.
 */
const FACTORY_ACTORS = new Set(['factory', 'system', 'automation']);

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
  /** Distinct in-flight cards (at least one non-done stage). */
  wipTotal: number;
  /** Oldest in-flight cards by time in their current stage. */
  agingWip: { id: string; title: string; stage: string; enteredAt: string; url: string | null }[];
  /** Cards created in the window, by source. */
  sourceMix: { source: string; count: number }[];
  /** Stage moves in the window: human-performed vs total. */
  transitions: { human: number; total: number };
}

/** Parse an untrusted `from`/`to` query param (ISO date or datetime) to epoch ms. */
function parseRangeParam(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

/**
 * Resolve untrusted `from`/`to` query params into a bounded epoch-ms window.
 * Defaults to the last {@link DEFAULT_METRICS_WINDOW} days, clamps the end to
 * `now`, falls back to the default span when the ordering is invalid, and caps
 * the span at {@link MAX_METRICS_WINDOW} days so the throughput array stays bounded.
 */
export function parseMetricsRange(
  fromParam: unknown,
  toParam: unknown,
  now: Date,
): { windowStart: number; windowEnd: number } {
  const nowMs = now.getTime();
  const windowEnd = Math.min(parseRangeParam(toParam) ?? nowMs, nowMs);
  const parsedFrom = parseRangeParam(fromParam);
  const defaultStart = windowEnd - DEFAULT_METRICS_WINDOW * DAY_MS;
  let windowStart = parsedFrom !== undefined && parsedFrom < windowEnd ? parsedFrom : defaultStart;
  const earliestStart = windowEnd - MAX_METRICS_WINDOW * DAY_MS;
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

/** Open (no `exitedAt`) history entry for a currently-held non-done stage. */
function openEntries(item: WorkItemRow): WorkItemStageEntry[] {
  return item.stageHistory.filter(
    entry => entry.exitedAt === undefined && entry.stage !== DONE_STAGE && item.stages.includes(entry.stage),
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
  // Gap-fill one bucket per whole UTC day covered by the window. Start at the
  // first midnight at or after `windowStart` so a rolling "last N days" yields N
  // buckets (the partial opening day isn't a full day and is dropped).
  const throughputByDay = new Map<string, number>();
  let firstDay = Date.parse(`${utcDay(windowStart)}T00:00:00Z`);
  if (firstDay < windowStart) firstDay += DAY_MS;
  for (let day = firstDay; day <= windowEnd; day += DAY_MS) {
    throughputByDay.set(utcDay(day), 0);
  }
  const cycleSamples: number[] = [];
  for (const item of items) {
    const doneAt = completedAt(item);
    if (doneAt === undefined || doneAt < windowStart || doneAt > windowEnd) continue;
    const day = utcDay(doneAt);
    throughputByDay.set(day, (throughputByDay.get(day) ?? 0) + 1);
    cycleSamples.push(Math.max(0, doneAt - item.createdAt.getTime()));
  }

  // ── Stage durations (visits that ended in window) ─────────────────────────
  const durationsByStage = new Map<string, number[]>();
  for (const item of items) {
    for (const entry of item.stageHistory) {
      if (entry.exitedAt === undefined || entry.stage === DONE_STAGE) continue;
      const exited = parseTime(entry.exitedAt);
      if (exited < windowStart || exited > windowEnd) continue;
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
    const inFlightStages = item.stages.filter(stage => stage !== DONE_STAGE);
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
    if (item.createdAt.getTime() >= windowStart) {
      const source = item.externalSource
        ? `${item.externalSource.integrationId}:${item.externalSource.type}`
        : 'manual';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    for (const entry of item.stageHistory) {
      const entered = parseTime(entry.enteredAt);
      if (entered < windowStart || entered > windowEnd) continue;
      transitionsTotal += 1;
      if (!FACTORY_ACTORS.has(entry.by)) transitionsHuman += 1;
    }
  }

  return {
    windowDays: Math.round((windowEnd - windowStart) / DAY_MS),
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
  };
}
