/**
 * The cohort funnel: where the window's work stopped, what came back, and how
 * each hop between two gates was made.
 */

import { isAgentActor } from '../base.js';
import type { WorkItemRow } from '../base.js';
import type { Window } from './base.js';
import {
  CANCELED_STAGE,
  FUNNEL_GATES,
  dwellMs,
  isPipelineStage,
  parseTime,
  percentile,
  sentBackAt,
  share,
} from './base.js';

export interface FactoryFunnel {
  gates: {
    stage: string;
    /** Cards that got at least this far. */
    reached: number;
    /** Of the ones that got no further: abandoned here. */
    canceled: number;
    /** Of the ones that got no further: still open here. */
    stalled: number;
  }[];
  /**
   * Every hop the cohort made between two gates, including the ones that run
   * backwards. A band's thickness comes from the gates; this says who made the
   * hop and how long the card waited before it.
   */
  edges: {
    from: string;
    to: string;
    count: number;
    /** Of those: hops an agent closed the departing stage for. */
    byAgent: number;
    dwellMedianMs: number;
    dwellP90Ms: number;
  }[];
  /**
   * Cards the pipeline sent back to a gate they had already passed, and what
   * the redo cost them: pipeline stage time from the move backwards on, a visit
   * still open counted up to the window's end.
   */
  rework: { cards: number; medianExtraMs: number | null; percent: number | null };
}

/**
 * Cards whose first pipeline pass started inside the window. Anchoring the
 * cohort on that rather than on creation keeps a card that sat in intake for
 * weeks out of the cohort of the week it finally moved.
 */
export function pulledInDuringWindow(item: WorkItemRow, { windowStart, windowEnd }: Window): boolean {
  const first = item.stageHistory.find(entry => isPipelineStage(entry.stage));
  if (!first) return false;
  const entered = parseTime(first.enteredAt);
  return entered >= windowStart && entered < windowEnd;
}

/** Furthest {@link FUNNEL_GATES} index the card ever entered; `-1` if none. */
function furthestGate(item: WorkItemRow): number {
  let furthest = -1;
  for (const entry of item.stageHistory) furthest = Math.max(furthest, FUNNEL_GATES.indexOf(entry.stage));
  return furthest;
}

/**
 * Stage time a card re-spent after it was sent back, or `null` if it never
 * went backwards. Everything from the move backwards on is the redo — including
 * a stage the card skipped the first time round, which is a send-back with no
 * earlier visit to repeat.
 */
export function reworkCostMs(item: WorkItemRow, until: number): number | null {
  const from = sentBackAt(item);
  if (from === -1) return null;
  let cost = 0;
  for (const entry of item.stageHistory.slice(from)) {
    if (isPipelineStage(entry.stage)) cost += dwellMs(entry, until);
  }
  return cost;
}

function hops(cohort: WorkItemRow[]): FactoryFunnel['edges'] {
  const dwellsByEdge = new Map<string, { from: string; to: string; byAgent: number; dwells: number[] }>();
  for (const item of cohort) {
    item.stageHistory.forEach((entry, index) => {
      const next = item.stageHistory[index + 1];
      if (!next || entry.exitedAt === undefined) return;
      if (!FUNNEL_GATES.includes(entry.stage) || !FUNNEL_GATES.includes(next.stage)) return;
      const key = `${entry.stage}→${next.stage}`;
      const edge = dwellsByEdge.get(key) ?? { from: entry.stage, to: next.stage, byAgent: 0, dwells: [] };
      if (isAgentActor(entry.exitedBy)) edge.byAgent += 1;
      edge.dwells.push(parseTime(entry.exitedAt) - parseTime(entry.enteredAt));
      dwellsByEdge.set(key, edge);
    });
  }
  return [...dwellsByEdge.values()].map(({ from, to, byAgent, dwells }) => ({
    from,
    to,
    count: dwells.length,
    byAgent,
    dwellMedianMs: percentile(dwells, 0.5)!,
    dwellP90Ms: percentile(dwells, 0.9)!,
  }));
}

/** Where the window's cohort got to, how it moved, and how much of it came back. */
export function funnel(items: WorkItemRow[], window: Window): FactoryFunnel {
  const cohort = items.filter(item => pulledInDuringWindow(item, window));
  const gates = FUNNEL_GATES.map(stage => ({ stage, reached: 0, canceled: 0, stalled: 0 }));
  const shipped = FUNNEL_GATES.length - 1;
  const redoCosts: number[] = [];

  for (const item of cohort) {
    const redoCost = reworkCostMs(item, window.windowEnd);
    if (redoCost !== null) redoCosts.push(redoCost);
    const furthest = furthestGate(item);
    for (let gate = 0; gate <= furthest; gate++) gates[gate]!.reached += 1;
    const stopped = furthest === shipped ? undefined : gates[furthest];
    if (!stopped) continue;
    if (item.stageHistory.some(entry => entry.stage === CANCELED_STAGE)) stopped.canceled += 1;
    else stopped.stalled += 1;
  }

  return {
    gates,
    edges: hops(cohort),
    rework: {
      cards: redoCosts.length,
      medianExtraMs: percentile(redoCosts, 0.5),
      percent: share(redoCosts.length, cohort.length),
    },
  };
}
