/**
 * What the Breakdown card's table shows for a tab: its rows, columns, labels, formats and
 * drilldowns. Pure, so the card only wires queries to it.
 */
import type { DrilldownScope } from '../drilldown';
import type { BreakdownRow, BreakdownTab, Change, ChangeMetric, PreviousFigures } from './breakdown';
import { BREAKDOWN_SPAN_TYPES, countsSpans, isEntityTab, withDropped } from './breakdown';
import { formatCount, formatDuration, formatPercent, formatUsd } from './chart-format';
import { previousWindow } from './time-window';
import { toTraceAggregateTimeRange } from './trace-aggregate';

export const DASH = '—';

/** What the Change column can compare: the sorted column, or the last one sorted. */
const CHANGE_METRICS: readonly string[] = ['count', 'errorRate', 'p95', 'tokens', 'cost'];
export const isChangeMetric = (key: string): key is ChangeMetric => CHANGE_METRICS.includes(key);

/** The count column's header: traces, or spans where one trace makes many (tool and model calls). */
export const volumeLabel = (tab: BreakdownTab) => (countsSpans(tab) ? 'Spans' : 'Traces');

const TRACE_DESCRIPTION = 'A trace is one end-to-end request, with every step it took.';
const SPAN_DESCRIPTION =
  'A span is one step inside a trace, such as a tool call or a model call. One trace can have many.';

/** The count column's tooltip: explains whichever unit the tab counts. */
export const countDescription = (tab: BreakdownTab) => (countsSpans(tab) ? SPAN_DESCRIPTION : TRACE_DESCRIPTION);

const METRIC_LABEL: Record<Exclude<ChangeMetric, 'count'>, string> = {
  errorRate: 'Errors',
  p95: 'P95 latency',
  tokens: 'Tokens',
  cost: 'Cost',
};

const fmtMoment = (d: Date) =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtRange = ({ start, end }: { start: Date; end: Date }) => `${fmtMoment(start)} – ${fmtMoment(end)}`;

/** The Change column's tooltip: what it compares, with both ranges' dates. */
export function changeDescription(window: { start: Date; end: Date }) {
  return {
    summary: 'Compares the selected range with the previous range of the same length. Sort a column to compare it.',
    current: `Selected: ${fmtRange(window)}`,
    previous: `Previous: ${fmtRange(previousWindow(window))}`,
  };
}

/** Org-wide, every tab but Projects names each row's project in its own column. */
export const showsProject = (tab: BreakdownTab, byProject: boolean) => byProject && tab !== 'projects';

/**
 * The table's narrowest width before it scrolls sideways: room for the label (at its narrowest) and
 * every column. Threads at org scope have both Project and Resource.
 */
export function tableMinWidth(project: boolean, threads: boolean) {
  if (project && threads) return 'min-w-280';
  if (project) return 'min-w-248';
  return threads ? 'min-w-240' : 'min-w-200';
}

/** The compared column's header, so "Cost change" sits beside Cost. */
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
  if (tab === 'environments') return row.name ? { ...project, environment: row.name } : project;
  if (tab === 'threads') return { ...project, threadId: row.name };
  if (tab === 'models') return row.name ? { ...project, model: row.name } : project;
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

/** A tab's scope moved to the previous window of the same length, for Change. */
export function previousScope<Scope extends { window: { start: Date; end: Date } }>(scope: Scope) {
  const window = previousWindow(scope.window);
  return { ...scope, window, timeRange: toTraceAggregateTimeRange(window) };
}
