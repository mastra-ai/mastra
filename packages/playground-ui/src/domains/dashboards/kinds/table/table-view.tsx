import type { DashboardQuery } from '@mastra/client-js';
import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { formatCount } from '../../../metrics/lib/chart-format';
import { useDrilldown } from '../../hooks/use-widget-views';
import { aggregateSource } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { isValueColumn, parseColumns, rowDrilldown, rowQueries, tableContent, valueChange } from '../../lib/table';
import type { TableRow } from '../../lib/table';
import { tableColumn } from './table-columns';
import { TableFrame } from './table-frame';
import type { TableTabProps } from './table-frame';
import { MetricsTable } from '@/ds/components/MetricsTable';
import type { MetricsTableSort } from '@/ds/components/MetricsTable';
import { Txt } from '@/ds/components/Txt';

const isAggregate = (query: DashboardQuery | undefined) => query !== undefined && aggregateSource(query) !== undefined;

export function TableView(props: TableTabProps & { index: number; page: DashboardPageContext }) {
  const { view, index, page, widget, onDrilldown, state, onStateChange, results, onRetry, projectLabel } = props;
  const { options, queries } = view;
  const onClick = useDrilldown(widget, view, onDrilldown);
  const { columns } = parseColumns(view.columns);
  const values = columns.filter(isValueColumn);
  const sort = state.sort ?? options.defaultSort;
  // % Change compares the value column sorted last, starting from the default sort's.
  const compared = state.compared ?? values.find(c => c.id === options.defaultSort.column)?.id ?? values[0]?.id;
  // Sorting keeps the open tab, so a late row count can't switch it under the new sort.
  const onSortChange = (next: MetricsTableSort = options.defaultSort) =>
    onStateChange({
      ...state,
      view: index,
      sort: next,
      compared: values.some(c => c.id === next.column) ? next.column : compared,
    });

  const rowIds = new Set(rowQueries(columns, queries));
  const isRowQuery = (i: number) => {
    const id = queries[i]?.id;
    return id !== undefined && rowIds.has(id);
  };
  const current = results.slice(0, queries.length);
  // The previous window never holds the table up: until it answers, or if it fails, Change shows a dash.
  const previous = results.slice(queries.length);

  const waited = current.flatMap((r, i) => (r && isRowQuery(i) ? [r] : []));
  if (waited.some(r => r.isError)) {
    return (
      <TableFrame {...props}>
        <ChartCardError error={waited.find(r => r.isError)?.error} onRetry={onRetry} />
      </TableFrame>
    );
  }

  const isLoading = waited.some(r => r.isLoading);
  const previousSettled = previous.every((r, i) => !r || !isRowQuery(i) || (!r.isLoading && !r.isError));
  const content = isLoading
    ? undefined
    : tableContent(
        options,
        columns,
        queries,
        current.map(r => r?.data),
        previousSettled ? previous.map(r => r?.data) : undefined,
      );
  const before = content?.before;
  const aggregates = current.flatMap((r, i) => (r && isRowQuery(i) && isAggregate(queries[i]) ? [r] : []));

  const comparedColumn = values.find(c => c.id === compared);
  const changeOf = (row: TableRow) =>
    before && comparedColumn
      ? valueChange(comparedColumn, row.values[comparedColumn.id], before.get(row.key)?.[comparedColumn.id])
      : undefined;

  return (
    <TableFrame {...props} isUpdating={aggregates.length ? aggregates.some(r => r.isRefetching) : undefined}>
      <ChartArea>
        <MetricsTable
          aria-label={options.ariaLabel}
          columns={columns.map(c => tableColumn(c, page.window, comparedColumn, changeOf, projectLabel))}
          rows={content?.rows ?? []}
          getRowKey={row => row.key}
          sort={sort}
          defaultSort={options.defaultSort}
          onSortChange={onSortChange}
          onRowClick={onClick && (row => onClick(rowDrilldown(options, row)))}
          pageSize={options.pageSize}
          isLoading={isLoading}
          empty={options.emptyMessage}
        />
        {content?.truncated && content.limit !== undefined && (
          <Txt variant="caption" tone="muted" className="pt-2">
            Showing the {formatCount(content.limit)} busiest; sorting covers only these.
          </Txt>
        )}
      </ChartArea>
    </TableFrame>
  );
}
