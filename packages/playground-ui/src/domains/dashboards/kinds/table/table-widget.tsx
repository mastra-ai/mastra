import type { DashboardQuery } from '@mastra/client-js';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BreakdownChangeDescription } from '../../../metrics/components/breakdown/breakdown-change-description';
import { BreakdownFigure } from '../../../metrics/components/breakdown/breakdown-figure';
import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { formatCount } from '../../../metrics/lib/chart-format';
import { ViewGate } from '../../components/view-gate';
import type { BlockedFields } from '../../components/view-gate';
import { ViewTabs } from '../../components/widget-controls';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { useDrilldown, useViewTabs } from '../../hooks/use-widget-views';
import { rowsOf } from '../../lib/answers';
import { unsupportedMessage, viewHeading } from '../../lib/chrome';
import { aggregateSource, buildPreviousRequest, buildRequest } from '../../lib/requests';
import type { DashboardAnswer, DashboardPageContext } from '../../lib/requests';
import {
  buildTableRows,
  isValueColumn,
  listedRows,
  openingView,
  parseColumns,
  previousTableValues,
  rowDrilldown,
  rowQueries,
  valueChange,
} from '../../lib/table';
import type { TableColumn, TableOptions, TableRow, ValueColumn } from '../../lib/table';
import { answersById, exprRefs } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { TableChangeCell, TableDimensionCell, TableNameCell, TableValueCell } from './table-cells';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsTable } from '@/ds/components/MetricsTable';
import type { MetricsTableColumn, MetricsTableSort } from '@/ds/components/MetricsTable';
import { Txt } from '@/ds/components/Txt';

type Props = WidgetKindProps<TableOptions>;
type View = ResolvedView<TableOptions>;
type TabProps = Props & { view: View; index: number; onChoose: (index: number) => void };

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
  return (
    <ViewGate
      queries={props.views.flatMap(v => v.queries)}
      partial
      pending={() => (
        <ChartCard title={props.widget.title ?? ''} bodyHeight="fit">
          <MetricsCard.Loading />
        </ChartCard>
      )}
    >
      {(page, blocked) => <TableTabs {...props} page={page} blocked={blocked} />}
    </ViewGate>
  );
}

/** The opener view's sorted column and the query it reads, when the opener can count its rows. */
function openerSource(views: Props['views'], blocked: BlockedFields) {
  const opener = views.find(v => v.options.openWhen);
  if (!opener || blocked(opener.queries)) return undefined;
  const column = viewColumns(opener)
    .filter(isValueColumn)
    .find(c => c.id === opener.options.defaultSort.column);
  const ref = column && exprRefs(column.options.value)[0];
  const query = opener.queries.find(q => q.id !== undefined && q.id === ref?.query);
  return column && query ? { view: opener, column, query } : undefined;
}

function TableTabs({ page, blocked, ...props }: Props & { page: DashboardPageContext; blocked: BlockedFields }) {
  // A view that opens only with enough rows counts them from its sorted column's own request, so
  // opening on it costs nothing more.
  const opener = openerSource(props.views, blocked);
  const [openerResult] = useDashboardRequests([opener && buildRequest(opener.query, page, {})]);
  const rows = opener ? countRows(opener, openerResult?.data) : null;
  const { view, index, choose } = useViewTabs(props.views, openingView(props.views, rows));

  const unsupported = blocked(view.queries);
  if (unsupported) {
    return (
      <TableFrame {...props} view={view} index={index} onChoose={choose}>
        <MetricsCard.NoData message={unsupportedMessage(unsupported, FILTER_NAMES)} />
      </TableFrame>
    );
  }
  return <TableView key={index} {...props} view={view} index={index} onChoose={choose} page={page} />;
}

/** Groups whose value in the opener's sorted column is above zero, once its request answers. */
function countRows(
  { view, query, column }: { view: View; query: DashboardQuery; column: ValueColumn },
  answer: DashboardAnswer | undefined,
) {
  if (!answer || query.id === undefined) return undefined;
  const answers = new Map([[query.id, answer]]);
  return buildTableRows(view.options, [column], [query], answers).filter(r => (r.values[column.id] ?? 0) > 0).length;
}

function TableFrame({
  widget,
  views,
  view,
  index,
  onChoose,
  isUpdating,
  children,
}: TabProps & { isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard
      {...viewHeading(widget, view)}
      isUpdating={isUpdating}
      bodyHeight="fit"
      toolbar={
        <MetricsCard.Toolbar>
          <ViewTabs views={views} index={index} onChoose={onChoose} />
        </MetricsCard.Toolbar>
      }
    >
      {children}
    </ChartCard>
  );
}

function TableView(props: TabProps & { page: DashboardPageContext }) {
  const { view, page, widget, onDrilldown } = props;
  const { options, queries } = view;
  const onClick = useDrilldown(widget, view, onDrilldown);
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

  const waited = current.filter((r, i) => r !== undefined && isRowQuery(i)).filter(r => r !== undefined);
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
    current.map(r => r?.data),
  );
  // Only aggregates cap their groups; the first that did names its cap.
  const capped = queries.find((q, i) => isRowQuery(i) && rowsOf(current[i]?.data)?.truncated === true);
  const limit = capped && 'limit' in capped ? capped.limit : undefined;
  const truncated = capped !== undefined;
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
            previous.map(r => r?.data),
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
    <TableFrame {...props} isUpdating={aggregates.length ? aggregates.some(r => r?.isRefetching) : undefined}>
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

function tableColumn(
  column: TableColumn,
  window: { start: Date; end: Date },
  compared: ValueColumn | undefined,
  changeOf: (row: TableRow) => ReturnType<typeof valueChange> | undefined,
): MetricsTableColumn<TableRow> {
  const o = column.options;
  const base = { id: column.id, header: column.label, description: o.description };
  switch (o.type) {
    case 'name':
      return {
        ...base,
        width: o.width,
        sortValue: o.sortable ? (row: TableRow) => row.name : undefined,
        firstDirection: 'asc',
        cell: row => <TableNameCell options={o} row={row} />,
      };
    case 'dimension':
      return {
        ...base,
        width: o.width,
        sortValue: o.sortable
          ? (row: TableRow) => (o.query === undefined ? row.dimensions[o.dimension] : row.lookups[column.id])
          : undefined,
        firstDirection: 'asc',
        cell: row => <TableDimensionCell id={column.id} options={o} row={row} />,
      };
    case 'value': {
      const value: ValueColumn = { id: column.id, label: column.label, options: o };
      return {
        ...base,
        align: 'end',
        width: o.width,
        sortValue: o.sortable === false ? undefined : (row: TableRow) => row.values[column.id],
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
