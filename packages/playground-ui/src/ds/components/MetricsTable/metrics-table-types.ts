import type { ReactNode } from 'react';

export type MetricsTableSortDirection = 'asc' | 'desc';

export type MetricsTableSort = { column: string; direction: MetricsTableSortDirection };

export type MetricsTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /**
   * CSS grid track. Use `fr` to share spare width relative to the table, e.g. `minmax(12rem,3fr)`
   * for the name: at least 12rem, and three shares of what's left. Fixed sizes (`7rem`) suit
   * fixed content like a sparkline. Default: `minmax(max-content,1fr)` for `end` (figure) columns,
   * so they shrink to their values on a narrow card and spread out on a wide one; `max-content`
   * for the rest.
   */
  width?: string;
  /** `end` for numbers. Default `start`. */
  align?: 'start' | 'end';
  /** Makes the column sortable by this value. Rows without one (`undefined`) sort last either way. */
  sortValue?: (row: Row) => number | string | undefined;
  /** Direction of the first click on this column. Default `desc` (largest first); `asc` suits names. */
  firstDirection?: MetricsTableSortDirection;
  /** Explains the column in a tooltip beside its header. */
  description?: ReactNode;
};

export type MetricsTableProps<Row> = {
  columns: MetricsTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Controlled sort, e.g. kept in the URL. Without it the table keeps its own, from `defaultSort`. */
  sort?: MetricsTableSort;
  /** Starting sort, and the order a third click on a column returns to. Without it, the given order. */
  defaultSort?: MetricsTableSort;
  /**
   * Called from a header: its first direction, the other, then off. Off is `defaultSort`, or
   * `undefined` without one (rows back in the given order).
   */
  onSortChange?: (sort: MetricsTableSort | undefined) => void;
  /** Row action (e.g. hide its series on the chart). The row gets focus, Enter and Space. */
  onRowClick?: (row: Row) => void;
  /** Row hover, e.g. to highlight its series on the chart; `undefined` when the pointer leaves. */
  onRowHover?: (row: Row | undefined) => void;
  /** Rows shown faded, e.g. a series hidden from the chart. */
  isRowDimmed?: (row: Row) => boolean;
  /** Rows shown highlighted, e.g. the one the page is filtered to. */
  isRowActive?: (row: Row) => boolean;
  /** Tooltip of a row, e.g. what clicking it does. */
  rowTitle?: (row: Row) => string | undefined;
  /** Shown in place of rows when there are none. */
  empty?: ReactNode;
  /** Rows per page; past it, pagination under the table. Without it every row shows. */
  pageSize?: number;
  /** Skeleton rows under the real header, so the card keeps its height when data lands. */
  isLoading?: boolean;
  'aria-label'?: string;
  className?: string;
};
