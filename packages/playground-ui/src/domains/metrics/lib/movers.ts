/**
 * Rows of the Biggest movers card: what changed most against the previous window of the same
 * length. Keys are the same as the Breakdown card's (`projectId`, or `spanType|entityName`).
 */
import type { AggregateSpansArgs, AggregateTracesResponse, MastraClient } from '@mastra/client-js';
import { BREAKDOWN_GROUP_LIMIT } from './breakdown';

/** What the card ranks at project scope: agents and workflows, nested runs included. */
export const MOVER_SPAN_TYPES = ['agent_run', 'workflow_run'] as const;

export const MOVER_ENTITY_GROUP_BY = ['spanType', 'entityName'];

/**
 * Runs, errors and P95 per agent and workflow, in one request for both so the card doesn't
 * depend on which Breakdown tab is open.
 */
export function moverEntitiesRequest({
  timeRange,
  where,
}: Pick<AggregateSpansArgs, 'timeRange' | 'where'>): AggregateSpansArgs {
  const types: NonNullable<AggregateSpansArgs['where']> = {
    op: 'in',
    value: { path: 'spanType' },
    set: [...MOVER_SPAN_TYPES],
  };
  return {
    timeRange,
    where: where ? { op: 'and', args: [types, where] } : types,
    groupBy: MOVER_ENTITY_GROUP_BY,
    measures: ['count', 'errorRate', 'duration.p95'],
    limit: BREAKDOWN_GROUP_LIMIT.span,
  };
}

type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>['series'][number];
type BreakdownGroup = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>['groups'][number];

/** Each series' cost over the window; `null` when none of its points has a price. */
export function costFromSeries(series: TimeSeries[], keyOf: (name: string) => string): [string, number | null][] {
  return series.map(s => {
    const priced = s.points.filter(p => typeof p.estimatedCost === 'number');
    return [keyOf(s.name), priced.length ? priced.reduce((sum, p) => sum + (p.estimatedCost ?? 0), 0) : null];
  });
}

/** Each group's cost; `null` when it has no price. */
export function costFromGroups(
  groups: BreakdownGroup[],
  dimension: string,
  keyOf: (value: string) => string,
): [string, number | null][] {
  return groups.map(g => [
    keyOf(String(g.dimensions[dimension] ?? '')),
    typeof g.estimatedCost === 'number' ? g.estimatedCost : null,
  ]);
}

export type MoverMetric = 'count' | 'errorRate' | 'p95' | 'cost';

export type MoverFigures = { count?: number; errorRate?: number | null; p95?: number | null; cost?: number | null };

export type Mover = {
  key: string;
  current: number;
  /** `null` when the key had no figure in the previous window: it is new. */
  previous: number | null;
  /** Relative change (0.5 = +50%); for error rate, the difference in points as a ratio (0.02 = +2 pt). */
  change: number | null;
};

type AggregateRow = AggregateTracesResponse['rows'][number];

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** The window just before `window`, of the same length. */
export function previousWindow({ start, end }: { start: Date; end: Date }) {
  return { start: new Date(2 * start.getTime() - end.getTime()), end: new Date(start.getTime()) };
}

/** "24 hours", "7 days": how the card names the window it compares with. */
export function windowLength({ start, end }: { start: Date; end: Date }) {
  const hours = Math.round((end.getTime() - start.getTime()) / 3_600_000);
  if (hours < 48 || hours % 24 !== 0) return hours === 1 ? 'hour' : `${hours} hours`;
  return `${hours / 24} days`;
}

/** Runs or traces, error rate and P95 per group, keyed by the group's values joined with `|`. */
export function figuresFromAggregate(rows: AggregateRow[], groupBy: string[]): Map<string, MoverFigures> {
  const figures = new Map<string, MoverFigures>();
  for (const row of rows) {
    const key = groupBy.map(d => row.dimensions?.[d] ?? '').join('|');
    figures.set(key, {
      count: num(row.measures.count) ?? 0,
      errorRate: num(row.measures.errorRate),
      p95: num(row.measures['duration.p95']),
    });
  }
  return figures;
}

/** Adds each key's cost; keys with cost but no runs get a row of their own. */
export function withCost(figures: Map<string, MoverFigures>, costs: Iterable<[string, number | null]>) {
  const merged = new Map(figures);
  for (const [key, cost] of costs) merged.set(key, { ...merged.get(key), cost });
  return merged;
}

/**
 * The keys whose `metric` moved most, ranked by the absolute difference so a small entity
 * doubling doesn't outrank a large one moving by thousands. New keys rank after every key with a
 * previous figure. A key that went quiet counts as a drop to zero for runs and cost; for error
 * rate and P95, no runs means no figure, not zero.
 */
export function buildMovers(
  current: Map<string, MoverFigures>,
  previous: Map<string, MoverFigures>,
  metric: MoverMetric,
  limit = 10,
): Mover[] {
  const movers: (Mover & { delta: number })[] = [];
  const add = (key: string, now: number, before: number | null) => {
    const delta = now - (before ?? 0);
    if (delta === 0) return;
    const change = before === null ? null : metric === 'errorRate' ? delta : before > 0 ? delta / before : null;
    movers.push({ key, current: now, previous: before, change, delta });
  };

  for (const [key, figures] of current) {
    const now = figures[metric];
    if (now === null || now === undefined) continue;
    add(key, now, previous.get(key)?.[metric] ?? null);
  }
  if (metric === 'count' || metric === 'cost') {
    for (const [key, figures] of previous) {
      const before = figures[metric];
      const now = current.get(key)?.[metric];
      if (before && (now === null || now === undefined)) add(key, 0, before);
    }
  }

  return movers
    .sort((a, b) => Number(a.previous === null) - Number(b.previous === null) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map(({ delta: _delta, ...mover }) => mover);
}

/** Whether a change is good news: more runs is; a higher error rate, P95 or cost isn't. */
export function moverTrend(mover: Mover, metric: MoverMetric): 'good' | 'bad' | null {
  if (mover.change === null || mover.change === 0) return null;
  return mover.change > 0 === (metric === 'count') ? 'good' : 'bad';
}
