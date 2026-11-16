import type { TraceAggregateRow } from '../../metrics/lib/trace-aggregate';
import type { DashboardAnswer } from './requests';

/** A point in a metrics or scores series. */
export type SeriesPoint = { timestamp: string | Date; value: number; estimatedCost?: number | null };
/** A series of a time series or percentiles answer: `name` is its group, `percentile` the one it plots. */
export type AnswerSeries = { name?: string; percentile?: number; points: SeriesPoint[] };

/** A metrics or scores aggregate: its value and, when compared, the previous window's. */
export type AggregateValue = {
  value?: number | null;
  previousValue?: number | null;
  changePercent?: number | null;
  estimatedCost?: number | null;
  previousEstimatedCost?: number | null;
  costChangePercent?: number | null;
};

/** A breakdown group of a metrics or scores breakdown. */
export type AnswerGroup = {
  dimensions: Record<string, string | null>;
  value: number;
  estimatedCost?: number | null;
  costUnit?: string | null;
};

/** The rows of a trace or span aggregate, else `undefined`. */
export function rowsOf(
  answer: DashboardAnswer | undefined,
): { rows: TraceAggregateRow[]; truncated?: boolean } | undefined {
  if (answer?.method === 'aggregateTraces' || answer?.method === 'aggregateSpans') return answer.data;
  return undefined;
}

/** The series of a metrics or scores time series or percentiles answer, else `undefined`. */
export function seriesOf(answer: DashboardAnswer | undefined): AnswerSeries[] | undefined {
  switch (answer?.method) {
    case 'getMetricTimeSeries':
    case 'getScoreTimeSeries':
      return answer.data.series.map(s => ({ name: s.name, points: s.points }));
    case 'getMetricPercentiles':
    case 'getScorePercentiles':
      return answer.data.series.map(s => ({ percentile: s.percentile, points: s.points }));
    default:
      return undefined;
  }
}

/** A metrics or scores aggregate's figures, else `undefined`. */
export function valueOf(answer: DashboardAnswer | undefined): AggregateValue | undefined {
  if (answer?.method === 'getMetricAggregate' || answer?.method === 'getScoreAggregate') return answer.data;
  return undefined;
}

/** The groups of a metrics or scores breakdown, else `undefined`. */
export function groupsOf(answer: DashboardAnswer | undefined): AnswerGroup[] | undefined {
  if (answer?.method === 'getMetricBreakdown' || answer?.method === 'getScoreBreakdown') return answer.data.groups;
  return undefined;
}

/** A measure of an aggregate row by name; `undefined` when the row doesn't have it. */
export function measureOf(measures: Readonly<Record<string, unknown>>, name: string): number | undefined {
  const value = new Map(Object.entries(measures)).get(name);
  return typeof value === 'number' ? value : undefined;
}
