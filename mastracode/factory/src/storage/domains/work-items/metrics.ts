/**
 * Aggregation math for the Factory Overview page.
 *
 * Pure functions over `work_items` rows — throughput, lead time, in-flight
 * count, demand mix and per-stage agent coverage, all read from the
 * server-appended `stageHistory` log. Keeping this DB-free makes the math unit
 * testable and lets the route stay a thin shell.
 *
 * Everything windowed is counted as an event that happened inside the window,
 * never as "the state the board happens to be in now", so re-querying a past
 * window always returns the same numbers.
 */

import { isAgentActor } from './base.js';
import type { WorkItemRow } from './base.js';
import type { Window } from './metrics/base.js';
import {
  CANCELED_STAGE,
  DAY_MS,
  DONE_STAGE,
  FUNNEL_GATES,
  hasFactoryRun,
  isPipelineStage,
  splitBoards,
  parseTime,
  percentile,
  share,
  stagesHeldAt,
  TERMINAL_STAGES,
  utcDay,
  utcDayStart,
} from './metrics/base.js';
import type { FactoryFunnel } from './metrics/funnel.js';
import { funnel } from './metrics/funnel.js';
import type { FactorySeries } from './metrics/series.js';
import { dailySeries } from './metrics/series.js';

/** Default window span (days) when the request omits or malforms the range. */
export const DEFAULT_METRICS_WINDOW = 30;
/** Hard cap on the range span (days) — bounds the gap-filled throughput array. */
export const MAX_METRICS_WINDOW = 366;

/**
 * Flow metrics over the cards the Factory ran ({@link hasFactoryRun}) — synced
 * upstream issues nobody started a run on are not the Factory's work and are
 * excluded from every field below except {@link FactoryMetrics.intake}, which
 * exists to report them.
 *
 * Every field is the *work* board. Reviewing a pull request and building a card
 * are different jobs on different clocks — minutes against days — so a median
 * over both lands between two answers and is neither. The review board is
 * counted apart, in {@link FactoryMetrics.review}.
 */
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
  /** Cards created in the window, by source. */
  sourceMix: { source: string; count: number }[];
  /**
   * Demand versus pickup, read over the whole board rather than the subset
   * every other field is scoped to. {@link hasFactoryRun} hides the synced
   * cards nobody started — and how many of those are piling up is what says
   * whether the Factory is keeping up with what gets filed at it.
   */
  intake: {
    /** Cards created in the window, whoever filed them. */
    arrived: number;
    /** Of those, the ones a run was started on. */
    pickedUp: number;
    /** Cards no run ever started on that are not terminal — the standing queue. */
    waiting: number;
  };
  /**
   * Cohort funnel over the cards first pulled into the pipeline during the
   * window, each counted once at the furthest gate it reached. `reached`
   * therefore only narrows, and each gate's drop is exactly the two counts
   * under it.
   */
  funnel: FactoryFunnel;
  /** One point per day in {@link throughput}, so a headline and its sparkline agree. */
  series: FactorySeries;
  /**
   * How long a first visit held a card, per pipeline stage, over the visits that
   * ended in the window. The funnel says where work stops; this says where it
   * lingers — the slowest stage is whichever row is highest, not a second field
   * that could disagree with them.
   */
  stageDwell: { stage: string; medianMs: number; p90Ms: number }[];
  /**
   * The same span immediately before the window. Null unless it covers as many
   * board days as the window itself — comparing a full period against one that
   * predates the first card reads every metric as growth from nothing.
   */
  previous: {
    completed: number;
    leadTimeMedianMs: number | null;
    agentCoveragePercent: number | null;
    reworkPercent: number | null;
  } | null;
  /**
   * The review board on its own clock: pull requests the Factory did not open
   * for a card of its own. Same vocabulary as the work board above, so the two
   * sections read the same way without ever being averaged together.
   */
  review: {
    intake: FactoryMetrics['intake'];
    /** Entries into `done` per UTC day, on the review board's own covered days. */
    throughput: FactoryMetrics['throughput'];
    /** Entries into `done` inside the window — reviews the Factory finished. */
    completed: number;
    /** Filed → reviewed, for every completion that landed in the window. */
    leadTime: FactoryMetrics['leadTime'];
  };
  /** {@link agentCoverage} read as one number, across every stage. */
  agentCoveragePercent: number | null;
  /** Per-stage agent coverage over first visits that ended in the window. */
  agentCoverage: {
    stage: string;
    /**
     * First visits to this stage that ended in the window. Repeat visits are
     * excluded from both sides: they are rework, already reported as such, and
     * counting them in the denominator alone caps a fully agent-run stage below
     * 100%.
     */
    passes: number;
    /**
     * Of those: passes an agent finished (`exitedBy` is an agent actor). The
     * entry actor is not required — the rules engine is what queues a card into
     * a stage, so demanding both ends would report 0% for stages agents run
     * end to end. Missing `exitedBy` (entries written before exit stamping)
     * does not count.
     */
    byAgent: number;
    /**
     * Outcomes of the agent-finished passes' items as of the window's end,
     * mutually exclusive, first match wins: `reworked` (a later visit to the
     * same stage — deliberately outranks `done`: a pass that needed a redo is a
     * failed pass even if the item eventually merged), then `done`, then
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

/**
 * Resolve untrusted `from`/`to` into a bounded half-open UTC window. A date-only
 * `to` covers the whole day; an open/future end resolves to the end of the
 * current UTC day (not `now`) so an event at this instant stays inside the
 * window instead of on its excluded edge.
 */
export function parseMetricsRange(fromParam: unknown, toParam: unknown, now: Date): Window {
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

/** Asserted up front so a corrupt row fails every window, not just the ones that read it. */
function assertParsableHistory(items: WorkItemRow[]): void {
  for (const item of items) {
    for (const entry of item.stageHistory) {
      parseTime(entry.enteredAt);
      if (entry.exitedAt !== undefined) parseTime(entry.exitedAt);
    }
  }
}

/**
 * Completions per UTC day, plus one lead-time sample each. A completion is an
 * entry *into* `done`, not the state of the card now: a card reopened today
 * must not erase the day it shipped, and a card that shipped twice shipped
 * twice. Days before the oldest card are left out rather than gap-filled with
 * zeroes that would drag the daily average down.
 */
function completions(items: WorkItemRow[], { windowStart, windowEnd }: Window) {
  let earliestItem = Infinity;
  for (const item of items) earliestItem = Math.min(earliestItem, item.createdAt.getTime());
  const boardStart = Number.isFinite(earliestItem) ? utcDayStart(earliestItem) : -Infinity;

  const byDay = new Map<string, number>();
  for (let day = Math.max(utcDayStart(windowStart), boardStart); day < windowEnd; day += DAY_MS) {
    byDay.set(utcDay(day), 0);
  }

  const leadSamples: number[] = [];
  for (const item of items) {
    for (const entry of item.stageHistory) {
      if (entry.stage !== DONE_STAGE) continue;
      const doneAt = parseTime(entry.enteredAt);
      if (doneAt < windowStart || doneAt >= windowEnd) continue;
      byDay.set(utcDay(doneAt), (byDay.get(utcDay(doneAt)) ?? 0) + 1);
      leadSamples.push(Math.max(0, doneAt - item.createdAt.getTime()));
    }
  }
  return { byDay, leadSamples };
}

/** Where the window's cards came from, most common first. */
function demandMix(items: WorkItemRow[], { windowStart, windowEnd }: Window): FactoryMetrics['sourceMix'] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const created = item.createdAt.getTime();
    if (created < windowStart || created >= windowEnd) continue;
    const source = item.externalSource ? `${item.externalSource.integrationId}:${item.externalSource.type}` : 'manual';
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

/**
 * How much of each stage's work an agent finished, counting a card's first
 * visit to a stage once. Rows appear in insertion order of each stage's first
 * counted exit; only pipeline stages get rows, since intake and terminal
 * stages have no pass to hand over.
 */
function agentCoverage(items: WorkItemRow[], { windowStart, windowEnd }: Window): FactoryMetrics['agentCoverage'] {
  const byStage = new Map<string, FactoryMetrics['agentCoverage'][number]>();
  for (const item of items) {
    const heldAtWindowEnd = stagesHeldAt(item, windowEnd);
    const visited = new Set<string>();
    for (let i = 0; i < item.stageHistory.length; i++) {
      const entry = item.stageHistory[i]!;
      if (!isPipelineStage(entry.stage) || visited.has(entry.stage)) continue;
      visited.add(entry.stage);
      if (entry.exitedAt === undefined) continue;
      const exited = parseTime(entry.exitedAt);
      if (exited < windowStart || exited >= windowEnd) continue;

      let row = byStage.get(entry.stage);
      if (!row) {
        row = {
          stage: entry.stage,
          passes: 0,
          byAgent: 0,
          outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 },
        };
        byStage.set(entry.stage, row);
      }
      row.passes += 1;
      if (!isAgentActor(entry.exitedBy)) continue;
      row.byAgent += 1;

      const reworked = item.stageHistory.some(
        (later, j) => j > i && later.stage === entry.stage && parseTime(later.enteredAt) < windowEnd,
      );
      if (reworked) row.outcomes.reworked += 1;
      else if (heldAtWindowEnd.has(DONE_STAGE)) row.outcomes.done += 1;
      else if (heldAtWindowEnd.has(CANCELED_STAGE)) row.outcomes.canceled += 1;
      else row.outcomes.inFlight += 1;
    }
  }
  return [...byStage.values()];
}

/** The per-stage rows read as one number. */
function coverageShare(rows: FactoryMetrics['agentCoverage']): number | null {
  const passes = rows.reduce((total, row) => total + row.passes, 0);
  const byAgent = rows.reduce((total, row) => total + row.byAgent, 0);
  return share(byAgent, passes);
}

/**
 * Time a first visit held a card, per pipeline stage. Scoped to visits that
 * *ended* in the window, like every other duration here: a visit still open has
 * only spent part of what it will.
 */
function stageDwell(items: WorkItemRow[], { windowStart, windowEnd }: Window): FactoryMetrics['stageDwell'] {
  const dwellsByStage = new Map<string, number[]>();
  for (const item of items) {
    const visited = new Set<string>();
    for (const entry of item.stageHistory) {
      if (!isPipelineStage(entry.stage) || visited.has(entry.stage)) continue;
      visited.add(entry.stage);
      if (entry.exitedAt === undefined) continue;
      const exited = parseTime(entry.exitedAt);
      if (exited < windowStart || exited >= windowEnd) continue;
      const dwells = dwellsByStage.get(entry.stage) ?? [];
      dwells.push(exited - parseTime(entry.enteredAt));
      dwellsByStage.set(entry.stage, dwells);
    }
  }

  return [...dwellsByStage.entries()]
    .map(([stage, dwells]) => ({ stage, medianMs: percentile(dwells, 0.5)!, p90Ms: percentile(dwells, 0.9)! }))
    .sort((a, b) => FUNNEL_GATES.indexOf(a.stage) - FUNNEL_GATES.indexOf(b.stage));
}

/**
 * The window's headline numbers over the same span immediately before it. Null
 * unless that span covers as many board days as the window, so a period can
 * only ever be compared against an equally long one.
 */
function previousPeriod(items: WorkItemRow[], window: Window, daysCovered: number): FactoryMetrics['previous'] {
  const span = window.windowEnd - window.windowStart;
  const before = { windowStart: window.windowStart - span, windowEnd: window.windowStart };
  const { byDay, leadSamples } = completions(items, before);
  if (byDay.size !== daysCovered) return null;
  return {
    completed: [...byDay.values()].reduce((total, count) => total + count, 0),
    leadTimeMedianMs: percentile(leadSamples, 0.5),
    agentCoveragePercent: coverageShare(agentCoverage(items, before)),
    reworkPercent: funnel(items, before).rework.percent,
  };
}

/** Demand versus pickup — see {@link FactoryMetrics.intake}. */
function intakeFlow(boardItems: WorkItemRow[], { windowStart, windowEnd }: Window): FactoryMetrics['intake'] {
  let arrived = 0;
  let pickedUp = 0;
  let waiting = 0;
  for (const item of boardItems) {
    const ran = hasFactoryRun(item);
    const created = item.createdAt.getTime();
    if (created >= windowStart && created < windowEnd) {
      arrived += 1;
      if (ran) pickedUp += 1;
    }
    if (!ran && !item.stages.some(stage => TERMINAL_STAGES.has(stage))) waiting += 1;
  }
  return { arrived, pickedUp, waiting };
}

function daily(byDay: Map<string, number>): FactoryMetrics['throughput'] {
  return [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The review board read on its own clock — see {@link FactoryMetrics.review}. */
function reviewFlow(threads: WorkItemRow[], window: Window): FactoryMetrics['review'] {
  const ran = threads.filter(hasFactoryRun);
  assertParsableHistory(ran);
  const { byDay, leadSamples } = completions(ran, window);
  const throughput = daily(byDay);
  return {
    intake: intakeFlow(threads, window),
    throughput,
    completed: throughput.reduce((total, point) => total + point.count, 0),
    leadTime: {
      medianMs: percentile(leadSamples, 0.5),
      p90Ms: percentile(leadSamples, 0.9),
      samples: leadSamples.length,
    },
  };
}

export function computeFactoryMetrics(boardItems: WorkItemRow[], window: Window): FactoryMetrics {
  const boards = splitBoards(boardItems);
  const items = boards.work.filter(hasFactoryRun);
  assertParsableHistory(items);

  const { byDay, leadSamples } = completions(items, window);
  const throughput = daily(byDay);
  const coverage = agentCoverage(items, window);

  return {
    daysCovered: byDay.size,
    throughput,
    leadTime: {
      medianMs: percentile(leadSamples, 0.5),
      p90Ms: percentile(leadSamples, 0.9),
      samples: leadSamples.length,
    },
    sourceMix: demandMix(items, window),
    intake: intakeFlow(boards.work, window),
    review: reviewFlow(boards.review, window),
    funnel: funnel(items, window),
    series: dailySeries(
      items,
      throughput.map(point => point.date),
      window,
    ),
    agentCoverage: coverage,
    agentCoveragePercent: coverageShare(coverage),
    stageDwell: stageDwell(items, window),
    previous: previousPeriod(items, window, byDay.size),
  };
}
