import type { DashboardQuery } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { BreakdownShareTable } from '../../../metrics/components/breakdown/breakdown-share-table';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { useMetricsFilters } from '../../../metrics/hooks/use-metrics-filters';
import { useMetricsScope } from '../../../metrics/hooks/use-metrics-scope';
import { useSpanAggregateGate } from '../../../metrics/hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../../../metrics/hooks/use-metrics-trace-aggregate';
import { BREAKDOWN_COLUMN_LABELS, COUNT_DESCRIPTION } from '../../../metrics/lib/breakdown-table';
import { useDrilldown, useViewTabs } from '../../components/widget-hooks';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import type { DashboardQueryResult } from '../../hooks/use-dashboard-requests';
import {
  buildTableRows,
  figureQueries,
  listedRows,
  parseColumns,
  previousTableFigures,
  rowDrilldown,
  tableRowLabel,
} from '../../lib/breakdown';
import type { BreakdownColumn, BreakdownOptions, BreakdownResponse } from '../../lib/breakdown';
import { unsupportedMessage, viewHeading } from '../../lib/chrome';
import { aggregateSource, buildPreviousRequest, buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';

type Props = WidgetKindProps<BreakdownOptions>;
type TraceGate = ReturnType<typeof useTraceAggregateGate>;
type SpanGate = ReturnType<typeof useSpanAggregateGate>;

/** Filters an aggregate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
  tags: 'tags',
  provider: 'provider',
  model: 'model',
};

const isAggregate = (query: DashboardQuery | undefined) => query !== undefined && aggregateSource(query) !== undefined;

/**
 * A table of groups with tabs. Like the Breakdown card, it waits on the aggregate gates every tab
 * needs, so tabs don't come and go; a tab whose gate can't apply the page's filters says so.
 */
export function BreakdownWidget(props: Props) {
  const queries = props.views.flatMap(v => v.queries);
  const needs = new Set(queries.map(aggregateSource));
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const gates = [...(needs.has('trace') ? [traceGate] : []), ...(needs.has('span') ? [spanGate] : [])];

  if (gates.some(g => g.status === 'unavailable')) return null;
  if (gates.some(g => g.status === 'loading')) {
    return (
      <ChartCard title={props.widget.title ?? ''} bodyHeight="fit">
        <MetricsCard.Loading />
      </ChartCard>
    );
  }
  return <BreakdownTabs {...props} traceGate={traceGate} spanGate={spanGate} />;
}

function BreakdownTabs({ traceGate, spanGate, ...props }: Props & { traceGate: TraceGate; spanGate: SpanGate }) {
  const { filters, timestamp } = useMetricsFilters();
  const page: DashboardPageContext = {
    window: timestamp,
    filters,
    ...(traceGate.status === 'ready' && traceGate.scope.where ? { traceWhere: traceGate.scope.where } : {}),
    ...(spanGate.status === 'ready' && spanGate.scope.where ? { spanWhere: spanGate.scope.where } : {}),
  };
  const unsupported = (view: ResolvedView<BreakdownOptions>) => {
    const sources = new Set(view.queries.map(aggregateSource));
    const blocked = [...(sources.has('trace') ? [traceGate] : []), ...(sources.has('span') ? [spanGate] : [])];
    const fields = blocked.flatMap(g => (g.status === 'unsupported-filter' ? g.unsupportedFields : []));
    return fields.length ? [...new Set(fields)] : undefined;
  };

  // A view that opens only with two or more rows asks for its count first; the request is its own,
  // so opening on it costs nothing more.
  const openerIndex = props.views.findIndex(v => v.options.openWhen === 'twoOrMoreRows');
  const opener = props.views[openerIndex];
  const openerCount =
    opener && !unsupported(opener) ? parseColumns(opener.columns).columns.find(c => c.id === 'count') : undefined;
  const openerQuery = openerCount?.options.query === undefined ? undefined : opener?.queries[openerCount.options.query];
  const [openerResult] = useDashboardRequests([openerQuery ? buildRequest(openerQuery, page, {}) : undefined]);
  const withData = countRows(openerResult, openerCount);
  const opening =
    openerIndex < 0 ? 0 : openerQuery && (withData === undefined || withData >= 2) ? openerIndex : openerIndex + 1;

  const { view, index, tabs } = useViewTabs(props.views, opening);
  const blocked = unsupported(view);
  if (blocked) {
    return (
      <BreakdownFrame {...props} view={view} tabs={tabs}>
        <MetricsCard.NoData message={unsupportedMessage(blocked, FILTER_NAMES)} />
      </BreakdownFrame>
    );
  }
  return <BreakdownView key={index} {...props} view={view} tabs={tabs} page={page} />;
}

/** Rows with a count above zero in the opener's answer, once it has one. */
function countRows(result: DashboardQueryResult | undefined, column: BreakdownColumn | undefined) {
  const data = result?.data as BreakdownResponse | undefined;
  if (!data || !column) return undefined;
  if ('groups' in data) return data.groups.filter(g => g.value > 0).length;
  const measure = column.options.measure ?? 'count';
  return data.rows.filter(r => Number(r.measures[measure] ?? 0) > 0).length;
}

function BreakdownFrame({
  widget,
  view,
  tabs,
  isUpdating,
  children,
}: Props & { view: ResolvedView<BreakdownOptions>; tabs: ReactNode; isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard
      {...viewHeading(widget, view)}
      isUpdating={isUpdating}
      bodyHeight="fit"
      toolbar={<MetricsCard.Toolbar>{tabs}</MetricsCard.Toolbar>}
    >
      {children}
    </ChartCard>
  );
}

function BreakdownView(
  props: Props & { view: ResolvedView<BreakdownOptions>; tabs: ReactNode; page: DashboardPageContext },
) {
  const { view, page, widget, onDrilldown } = props;
  const { options, queries } = view;
  const { projectLabel } = useMetricsScope();
  const { onClick } = useDrilldown(widget, view, onDrilldown);
  const { columns } = parseColumns(view.columns);
  const waitedOn = new Set(figureQueries(columns));

  const current = useDashboardRequests(queries.map(q => buildRequest(q, page, {})));
  // The previous window never holds the table up: until it answers, or if it fails, Change shows a dash.
  const previous = useDashboardRequests(queries.map(q => buildPreviousRequest(q, page, {})));

  const waited = current.filter((r, i): r is DashboardQueryResult => r !== undefined && waitedOn.has(i));
  const has = (id: BreakdownColumn['id']) => columns.some(c => c.id === id);
  const count = columns.find(c => c.id === 'count');
  const countQuery = count?.options.query;
  const countResult = countQuery === undefined ? undefined : current[countQuery];
  const countIsAggregate = isAggregate(countQuery === undefined ? undefined : queries[countQuery]);

  if (waited.some(r => r.isError)) {
    return (
      <BreakdownFrame {...props}>
        <ChartCardError onRetry={() => waited.forEach(r => r.isError && void r.refetch())} />
      </BreakdownFrame>
    );
  }

  const isLoading = waited.some(r => r.isLoading);
  const responses = current.map(r => r?.data as BreakdownResponse | undefined);
  const truncated =
    countIsAggregate && (responses[countQuery ?? -1] as { truncated?: boolean } | undefined)?.truncated === true;
  const built = isLoading ? [] : buildTableRows(options, columns, responses);
  const previousWaited = previous.filter((r, i) => r !== undefined && waitedOn.has(i));
  const previousSettled = previousWaited.every(r => !r?.isLoading && !r?.isError);
  const previousFigures =
    previousSettled && !isLoading
      ? previousTableFigures(
          options,
          columns,
          previous.map(r => r?.data as BreakdownResponse | undefined),
        )
      : undefined;
  const usage = has('tokens');
  const countLimit = countIsAggregate
    ? (queries[countQuery ?? -1] as { limit?: number } | undefined)?.limit
    : undefined;
  const label = (id: BreakdownColumn['id']) => columns.find(c => c.id === id)?.label;

  return (
    <BreakdownFrame {...props} isUpdating={countIsAggregate ? countResult?.isPlaceholderData : undefined}>
      <BreakdownShareTable
        rows={listedRows(options, built, previousFigures, truncated, usage)}
        previous={previousFigures}
        columns={{ project: has('project'), resource: has('resource'), errors: has('errorRate'), usage }}
        labels={{
          project: label('project') ?? BREAKDOWN_COLUMN_LABELS.project,
          resource: label('resource') ?? BREAKDOWN_COLUMN_LABELS.resource,
          errorRate: label('errorRate') ?? BREAKDOWN_COLUMN_LABELS.errorRate,
          p95: label('p95') ?? BREAKDOWN_COLUMN_LABELS.p95,
          tokens: label('tokens') ?? BREAKDOWN_COLUMN_LABELS.tokens,
          cost: label('cost') ?? BREAKDOWN_COLUMN_LABELS.cost,
          count: label('count') ?? 'Count',
        }}
        countDescription={COUNT_DESCRIPTION[count?.options.unit ?? 'traces']}
        rowLabel={row => tableRowLabel(options, row, projectLabel)}
        onRowClick={onClick && (row => onClick(rowDrilldown(options, row)))}
        emptyState={options.emptyMessage}
        window={page.window}
        isLoading={isLoading}
        {...(truncated && countLimit !== undefined ? { truncatedAt: countLimit } : {})}
      />
    </BreakdownFrame>
  );
}
