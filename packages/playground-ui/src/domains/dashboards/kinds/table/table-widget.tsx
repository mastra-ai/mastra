import type { DashboardQuery } from '@mastra/client-js';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BreakdownChangeDescription } from '../../../metrics/components/breakdown/breakdown-change-description';
import { BreakdownFigure } from '../../../metrics/components/breakdown/breakdown-figure';
import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { useMetricsFilters } from '../../../metrics/hooks/use-metrics-filters';
import { useSpanAggregateGate } from '../../../metrics/hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../../../metrics/hooks/use-metrics-trace-aggregate';
import { formatCount } from '../../../metrics/lib/chart-format';
import { useDrilldown, useViewTabs } from '../../components/widget-hooks';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import type { DashboardQueryResult } from '../../hooks/use-dashboard-requests';
import { unsupportedMessage, viewHeading } from '../../lib/chrome';
import { aggregateSource, buildPreviousRequest, buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import {
  buildTableRows,
  isValueColumn,
  listedRows,
  parseColumns,
  previousTableValues,
  rowDrilldown,
  rowQueries,
  valueChange,
} from '../../lib/table';
import type { TableColumn, TableOptions, TableResponse, TableRow, ValueColumn } from '../../lib/table';
import { answersById, exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { TableChangeCell, TableDimensionCell, TableNameCell, TableValueCell } from './table-cells';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsTable } from '@/ds/components/MetricsTable';
import type { MetricsTableColumn, MetricsTableSort } from '@/ds/components/MetricsTable';
import { Txt } from '@/ds/components/Txt';

type Props = WidgetKindProps<TableOptions>;
type View = ResolvedView<TableOptions>;
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

const viewColumns = (view: View) => parseColumns(view.columns).columns;

/**
 * Groups as a sortable table, one view per tab. It waits on the aggregate gates every tab needs, so tabs
 * don't come and go; a tab whose gate can't apply the page's filters says so.
 */
export function TableWidget(props: Props) {
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
  return <TableTabs {...props} traceGate={traceGate} spanGate={spanGate} />;
}

function TableTabs({ traceGate, spanGate, ...props }: Props & { traceGate: TraceGate; spanGate: SpanGate }) {
  const { filters, timestamp } = useMetricsFilters();
  const page: DashboardPageContext = {
    window: timestamp,
    filters,
    ...(traceGate.status === 'ready' && traceGate.scope.where ? { traceWhere: traceGate.scope.where } : {}),
    ...(spanGate.status === 'ready' && spanGate.scope.where ? { spanWhere: spanGate.scope.where } : {}),
  };
  const unsupported = (view: View) => {
    const sources = new Set(view.queries.map(aggregateSource));
    const blocked = [...(sources.has('trace') ? [traceGate] : []), ...(sources.has('span') ? [spanGate] : [])];
    const fields = blocked.flatMap(g => (g.status === 'unsupported-filter' ? g.unsupportedFields : []));
    return fields.length ? [...new Set(fields)] : undefined;
  };

  // A view that opens only with enough rows counts them from its sorted column's own request, so
  // opening on it costs nothing more. While that loads it stays open, so the tabs don't jump.
  const openerIndex = props.views.findIndex(v => v.options.openWhen);
  const opener = props.views[openerIndex];
  const openerColumn =
    opener && !unsupported(opener)
      ? viewColumns(opener)
          .filter(isValueColumn)
          .find(c => c.id === opener.options.defaultSort.column)
      : undefined;
  const openerRef = openerColumn && exprRefs(openerColumn.options.value)[0];
  const openerQuery = opener?.queries.find(q => q.id !== undefined && q.id === openerRef?.query);
  const [openerResult] = useDashboardRequests([openerQuery ? buildRequest(openerQuery, page, {}) : undefined]);
  const withData =
    opener && openerQuery && openerColumn ? countRows(opener, openerQuery, openerResult, openerColumn) : undefined;
  const minRows = opener?.options.openWhen?.minRows ?? 0;
  const opening =
    openerIndex < 0
      ? 0
      : openerQuery && (withData === undefined || withData >= minRows)
        ? openerIndex
        : openerIndex + 1;

  const { view, index, tabs } = useViewTabs(props.views, opening);
  const blocked = unsupported(view);
  if (blocked) {
    return (
      <TableFrame {...props} view={view} tabs={tabs}>
        <MetricsCard.NoData message={unsupportedMessage(blocked, FILTER_NAMES)} />
      </TableFrame>
    );
  }
  return <TableView key={index} {...props} view={view} tabs={tabs} page={page} />;
}

/** Groups whose value in the opener's sorted column is above zero, once its request answers. */
function countRows(view: View, query: DashboardQuery, result: DashboardQueryResult | undefined, column: ValueColumn) {
  if (!result?.data || query.id === undefined) return undefined;
  const answers = new Map([[query.id, result.data as TableResponse]]);
  return buildTableRows(view.options, [column], [query], answers).filter(r => (r.values[column.id] ?? 0) > 0).length;
}

function TableFrame({
  widget,
  view,
  tabs,
  isUpdating,
  children,
}: Props & { view: View; tabs: ReactNode; isUpdating?: boolean; children: ReactNode }) {
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

function TableView(props: Props & { view: View; tabs: ReactNode; page: DashboardPageContext }) {
  const { view, page, widget, onDrilldown } = props;
  const { options, queries } = view;
  const { onClick } = useDrilldown(widget, view, onDrilldown);
  const columns = viewColumns(view);
  const values = columns.filter(isValueColumn);
  const [sort, setSort] = useState<MetricsTableSort>(options.defaultSort);
  // % Change compares the value column sorted last, starting from the default sort's.
  const [compared, setCompared] = useState(
    () => values.find(c => c.id === options.defaultSort.column)?.id ?? values[0]?.id,
  );
  const onSortChange = (next: MetricsTableSort = options.defaultSort) => {
    setSort(next);
    if (values.some(c => c.id === next.column)) setCompared(next.column);
  };

  const rowIds = new Set(rowQueries(columns, queries));
  const isRowQuery = (i: number) => {
    const id = queries[i]?.id;
    return id !== undefined && rowIds.has(id);
  };
  const current = useDashboardRequests(queries.map(q => buildRequest(q, page, {})));
  // The previous window never holds the table up: until it answers, or if it fails, Change shows a dash.
  const previous = useDashboardRequests(queries.map(q => buildPreviousRequest(q, page, {})));

  const waited = current.filter((r, i): r is DashboardQueryResult => r !== undefined && isRowQuery(i));
  if (waited.some(r => r.isError)) {
    return (
      <TableFrame {...props}>
        <ChartCardError onRetry={() => waited.forEach(r => r.isError && void r.refetch())} />
      </TableFrame>
    );
  }

  const isLoading = waited.some(r => r.isLoading);
  const answers = answersById(
    queries,
    current.map(r => r?.data as TableResponse | undefined),
  );
  // Only aggregates cap their groups; the first that did names its cap.
  const capped = queries.findIndex((q, i) => isRowQuery(i) && isAggregate(q) && hasTruncated(current[i]));
  const limit = capped < 0 ? undefined : (queries[capped] as { limit?: number }).limit;
  const truncated = capped >= 0;
  const built = isLoading ? [] : buildTableRows(options, columns, queries, answers);
  const previousSettled = previous.every((r, i) => !r || !isRowQuery(i) || (!r.isLoading && !r.isError));
  const before =
    previousSettled && !isLoading
      ? previousTableValues(
          options,
          columns,
          queries,
          answersById(
            queries,
            previous.map(r => r?.data as TableResponse | undefined),
          ),
        )
      : undefined;
  const rows = listedRows(options, columns, built, before, truncated);
  const aggregates = current.filter((r, i) => r !== undefined && isRowQuery(i) && isAggregate(queries[i]));

  const comparedColumn = values.find(c => c.id === compared);
  const changeOf = (row: TableRow) =>
    before && comparedColumn
      ? valueChange(comparedColumn, row.values[comparedColumn.id], before.get(row.key)?.[comparedColumn.id])
      : undefined;

  return (
    <TableFrame {...props} isUpdating={aggregates.length ? aggregates.some(r => r?.isPlaceholderData) : undefined}>
      <ChartArea>
        <MetricsTable
          aria-label={options.ariaLabel}
          columns={columns.map(c => tableColumn(c, page.window, comparedColumn, changeOf))}
          rows={rows}
          getRowKey={row => row.key}
          sort={sort}
          defaultSort={options.defaultSort}
          onSortChange={onSortChange}
          onRowClick={onClick && (row => onClick(rowDrilldown(options, row)))}
          pageSize={options.pageSize}
          isLoading={isLoading}
          empty={options.emptyMessage}
        />
        {!isLoading && truncated && limit !== undefined && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Showing the {formatCount(limit)} busiest; sorting covers only these.
          </Txt>
        )}
      </ChartArea>
    </TableFrame>
  );
}

const hasTruncated = (result: DashboardQueryResult | undefined) =>
  (result?.data as { truncated?: boolean } | undefined)?.truncated === true;

function tableColumn(
  column: TableColumn,
  window: { start: Date; end: Date },
  compared: ValueColumn | undefined,
  changeOf: (row: TableRow) => ReturnType<typeof valueChange> | undefined,
): MetricsTableColumn<TableRow> {
  const o = column.options;
  const base = { id: column.id, header: column.label, ...(o.description ? { description: o.description } : {}) };
  switch (o.type) {
    case 'name':
      return {
        ...base,
        ...(o.width ? { width: o.width } : {}),
        ...(o.sortable ? { sortValue: (row: TableRow) => row.name, firstDirection: 'asc' as const } : {}),
        cell: row => <TableNameCell options={o} row={row} />,
      };
    case 'dimension':
      return {
        ...base,
        ...(o.width ? { width: o.width } : {}),
        ...(o.sortable
          ? {
              sortValue: (row: TableRow) =>
                o.query === undefined ? row.dimensions[o.dimension] : row.lookups[column.id],
              firstDirection: 'asc' as const,
            }
          : {}),
        cell: row => <TableDimensionCell id={column.id} options={o} row={row} />,
      };
    case 'value': {
      const value = column as ValueColumn;
      return {
        ...base,
        align: 'end',
        ...(o.width ? { width: o.width } : {}),
        ...(o.sortable === false ? {} : { sortValue: (row: TableRow) => row.values[column.id] }),
        cell: row => <TableValueCell column={value} row={row} />,
      };
    }
    case 'change':
      return {
        id: column.id,
        header: column.label,
        align: 'end',
        description: o.description ?? <BreakdownChangeDescription window={window} label={compared?.label ?? ''} />,
        // Sorted by the change shown: biggest rise first, biggest fall first the other way. New rows
        // have no change to rank, so they sort last.
        sortValue: row => changeOf(row)?.change,
        cell: row => (
          <BreakdownFigure>{compared && <TableChangeCell change={changeOf(row)} column={compared} />}</BreakdownFigure>
        ),
      };
  }
}
