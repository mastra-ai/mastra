import type { ReactNode } from 'react';

export type MetricsTableSortDirection = 'asc' | 'desc';

export type MetricsTableSort = { column: string; direction: MetricsTableSortDirection };

export type MetricsTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** CSS grid track, e.g. `minmax(0,1fr)` for the name or `7rem` for a sparkline. Default `max-content`. */
  width?: string;
  /** `end` for numbers. Default `start`. */
  align?: 'start' | 'end';
  /** Makes the column sortable by this value. */
  sortValue?: (row: Row) => number | string;
  /** Direction of the first click on this column. Default `desc` (largest first); `asc` suits names. */
  firstDirection?: MetricsTableSortDirection;
};

export type MetricsTableProps<Row> = {
  columns: MetricsTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Controlled sort, e.g. kept in the URL. Without it the table keeps its own, from `defaultSort`. */
  sort?: MetricsTableSort;
  /** Starting sort when `sort` isn't controlled. Without it, rows stay in the given order. */
  defaultSort?: MetricsTableSort;
  onSortChange?: (sort: MetricsTableSort) => void;
  /** Row action (e.g. hide its series on the chart). The row gets focus, Enter and Space. */
  onRowClick?: (row: Row) => void;
  /** Row hover, e.g. to highlight its series on the chart; `undefined` when the pointer leaves. */
  onRowHover?: (row: Row | undefined) => void;
  /** Rows shown faded, e.g. a series hidden from the chart. */
  isRowDimmed?: (row: Row) => boolean;
  /** Tooltip of a row, e.g. what clicking it does. */
  rowTitle?: (row: Row) => string | undefined;
  /** Shown in place of rows when there are none. */
  empty?: ReactNode;
  'aria-label'?: string;
  className?: string;
};
