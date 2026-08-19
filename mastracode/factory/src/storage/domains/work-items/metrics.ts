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

import { FACTORY_RULE_STAGES } from '../../../rules/types.js';
import { isAgentActor } from './base.js';
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

const INTAKE_STAGE = 'intake';

/**
 * Pipeline work excludes the inbox as well as the terminal stages: an intake
 * card is queued, not in flight, and its pass through is the poller filing it.
 */
function isPipelineStage(stage: string): boolean {
  return !TERMINAL_STAGES.has(stage) && stage !== INTAKE_STAGE;
}

/**
 * The funnel's axis: the pipeline in board order, capped by `done`. A card sits
 * at the furthest gate it ever entered, so one that skipped a stage still
 * counts as having got past it and the band can only ever narrow.
 */
const FUNNEL_GATES: string[] = [...FACTORY_RULE_STAGES.filter(isPipelineStage), DONE_STAGE];

/**
 * Cards the Factory ran: starting a run records its session on the row. The
 * integrations sync every issue and PR of a connected repo into the board and
 * those outnumber the Factory's own work by an order of magnitude, so counting
 * them reports the upstream repo's flow as the Factory's.
 */
function hasFactoryRun(item: WorkItemRow): boolean {
  return Object.keys(item.sessions).length > 0;
}

/**
 * Flow metrics over the cards the Factory ran ({@link hasFactoryRun}) — synced
 * upstream issues and PRs nobody started a run on are not the Factory's work
 * and are excluded from every field below except {@link FactoryMetrics.intake},
 * which exists to report them.
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
  /** Distinct cards in a pipeline stage — past intake, not yet terminal. */
  wipTotal: number;
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
  funnel: {
    gates: {
      stage: string;
      /** Cards that got at least this far. */
      reached: number;
      /** Of the ones that got no further: abandoned here. */
      canceled: number;
      /** Of the ones that got no further: still open here. */
      stalled: number;
    }[];
    /** Cards the pipeline sent back to a stage they had already passed. */
    sentBack: number;
  };
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

type Window = { windowStart: number; windowEnd: number };

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

/** Cards holding at least one pipeline stage right now — window-independent. */
function countInFlight(items: WorkItemRow[]): number {
  return items.filter(item => item.stages.some(isPipelineStage)).length;
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

/** Furthest {@link FUNNEL_GATES} index the card ever entered; `-1` if none. */
function furthestGate(item: WorkItemRow): number {
  let furthest = -1;
  for (const entry of item.stageHistory) furthest = Math.max(furthest, FUNNEL_GATES.indexOf(entry.stage));
  return furthest;
}

/** Card moved back into a gate it had already passed. */
function wasSentBack(item: WorkItemRow): boolean {
  let deepest = -1;
  for (const entry of item.stageHistory) {
    const gate = FUNNEL_GATES.indexOf(entry.stage);
    if (gate === -1) continue;
    if (gate < deepest) return true;
    deepest = gate;
  }
  return false;
}

/**
 * Cards whose first pipeline pass started inside the window. Anchoring the
 * cohort on that rather than on creation keeps a card that sat in intake for
 * weeks out of the cohort of the week it finally moved.
 */
function pulledInDuringWindow(item: WorkItemRow, { windowStart, windowEnd }: Window): boolean {
  const first = item.stageHistory.find(entry => isPipelineStage(entry.stage));
  if (!first) return false;
  const entered = parseTime(first.enteredAt);
  return entered >= windowStart && entered < windowEnd;
}

/** Where the window's cohort got to, and how much of it came back. */
function funnel(items: WorkItemRow[], window: Window): FactoryMetrics['funnel'] {
  const cohort = items.filter(item => pulledInDuringWindow(item, window));
  const gates = FUNNEL_GATES.map(stage => ({ stage, reached: 0, canceled: 0, stalled: 0 }));
  const shipped = FUNNEL_GATES.length - 1;
  for (const item of cohort) {
    const furthest = furthestGate(item);
    for (let gate = 0; gate <= furthest; gate++) gates[gate]!.reached += 1;
    const stopped = furthest === shipped ? undefined : gates[furthest];
    if (!stopped) continue;
    if (item.stageHistory.some(entry => entry.stage === CANCELED_STAGE)) stopped.canceled += 1;
    else stopped.stalled += 1;
  }
  return { gates, sentBack: cohort.filter(wasSentBack).length };
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

export function computeFactoryMetrics(boardItems: WorkItemRow[], window: Window): FactoryMetrics {
  const items = boardItems.filter(hasFactoryRun);
  assertParsableHistory(items);

  const { byDay, leadSamples } = completions(items, window);

  return {
    daysCovered: byDay.size,
    throughput: [...byDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    leadTime: {
      medianMs: percentile(leadSamples, 0.5),
      p90Ms: percentile(leadSamples, 0.9),
      samples: leadSamples.length,
    },
    wipTotal: countInFlight(items),
    sourceMix: demandMix(items, window),
    intake: intakeFlow(boardItems, window),
    funnel: funnel(items, window),
    agentCoverage: agentCoverage(items, window),
  };
}
