/**
 * What the Breakdown card's table shows for a tab: its rows, columns, labels, formats and
 * drilldowns. Pure, so the card only wires queries to it.
 */
import type { DrilldownScope } from '../drilldown';
import type { BreakdownRow, BreakdownTab, Change, ChangeMetric, PreviousFigures } from './breakdown';
import { BREAKDOWN_SPAN_TYPES, hasRuns, isEntityTab, withDropped } from './breakdown';
import { formatCount, formatDuration, formatPercent, formatUsd } from './chart-format';
import { previousWindow } from './time-window';
import { toTraceAggregateTimeRange } from './trace-aggregate';

export const DASH = '—';

/** What the Before and Change columns can compare: the sorted column, or the last one sorted. */
const CHANGE_METRICS: readonly string[] = ['count', 'errorRate', 'p95', 'tokens', 'cost'];
export const isChangeMetric = (key: string): key is ChangeMetric => CHANGE_METRICS.includes(key);

/** The column the table sorts and shares by: runs or traces, or tokens on a tab without runs. */
export const volumeMetric = (tab: BreakdownTab): ChangeMetric => (hasRuns(tab) ? 'count' : 'tokens');

/** The volume column's header. */
export function volumeLabel(tab: BreakdownTab) {
  if (tab === 'tools') return 'Calls';
  if (isEntityTab(tab)) return 'Runs';
  return hasRuns(tab) ? 'Traces' : 'Tokens';
}

const METRIC_LABEL: Record<Exclude<ChangeMetric, 'count'>, string> = {
  errorRate: 'Errors',
  p95: 'P95',
  tokens: 'Tokens',
  cost: 'Cost',
};

/** The compared column's header, so "Cost before" sits beside Cost. */
export const comparedLabel = (tab: BreakdownTab, metric: ChangeMetric) =>
  metric === 'count' ? volumeLabel(tab) : METRIC_LABEL[metric];

/**
 * The rows to list. Traces without a thread aren't a thread, and threads that ended are the norm,
 * so they aren't listed as dropped. Dropped rows need the whole previous window and current list.
 */
export function tableRows({
  tab,
  built,
  previous,
  truncated,
  groupBy,
  usage,
}: {
  tab: BreakdownTab;
  built: BreakdownRow[];
  previous: Map<string, PreviousFigures> | undefined;
  truncated: boolean;
  groupBy: readonly string[];
  usage: boolean;
}) {
  if (tab === 'threads') return built.filter(r => r.name !== '');
  if (!previous || truncated) return built;
  return withDropped(built, previous, groupBy, usage);
}

export function rowLabel(tab: BreakdownTab, row: BreakdownRow, projectLabel?: (projectId: string) => string) {
  if (tab === 'projects') return projectLabel?.(row.key) ?? row.key;
  if (row.name) return row.name;
  if (tab === 'environments') return 'No environment';
  if (tab === 'models') return 'Unknown model';
  return 'Unnamed';
}

export const rowProject = (tab: BreakdownTab, row: BreakdownRow) => (tab === 'projects' ? row.key : row.projectId);

export function drilldownFor(tab: BreakdownTab, row: BreakdownRow): DrilldownScope {
  const projectId = rowProject(tab, row);
  const project = projectId ? { projectId } : {};
  if (isEntityTab(tab)) return { ...project, span: { spanTypes: BREAKDOWN_SPAN_TYPES[tab], entityName: row.name } };
  if (tab === 'environments') return row.name ? { environment: row.name } : {};
  if (tab === 'threads') return { threadId: row.name };
  if (tab === 'models') return row.name ? { model: row.name } : {};
  return project;
}

/** Cost in dollars; stores report the unit as `USD` or `usd`. Another unit is named after the figure. */
export function formatCost(value: number, unit: string | undefined) {
  return unit && unit.toUpperCase() !== 'USD' ? `${formatCount(value)} ${unit}` : formatUsd(value);
}

const FORMAT: Record<ChangeMetric, (value: number, costUnit: string | undefined) => string> = {
  count: formatCount,
  errorRate: formatPercent,
  p95: formatDuration,
  tokens: formatCount,
  cost: formatCost,
};

export const formatMetric = (metric: ChangeMetric, value: number, costUnit: string | undefined) =>
  FORMAT[metric](value, costUnit);

export function formatChange(change: Change, metric: ChangeMetric) {
  if (change.isNew) return 'New';
  if (change.change === undefined) return DASH;
  if (change.change === 0) return metric === 'errorRate' ? '0 pt' : '0%';
  const sign = change.change > 0 ? '+' : '−';
  const size = Math.abs(change.change);
  if (metric !== 'errorRate') return `${sign}${formatPercent(size)}`;
  // Under 0.05 points rounds to "+0.0 pt", which reads as no change.
  return size < 0.0005 ? `${sign}<0.1 pt` : `${sign}${(size * 100).toFixed(1)} pt`;
}

/** A tab's scope moved to the previous window of the same length, for Before and Change. */
export function previousScope<Scope extends { window: { start: Date; end: Date } }>(scope: Scope) {
  const window = previousWindow(scope.window);
  return { ...scope, window, timeRange: toTraceAggregateTimeRange(window) };
}
