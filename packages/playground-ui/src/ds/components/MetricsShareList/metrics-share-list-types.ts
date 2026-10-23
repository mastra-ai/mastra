import type { ElementType, ReactNode } from 'react';

export type MetricsShareListRow = {
  /** Stable id, also used to link a row to its strip segment. */
  key: string;
  /** Row label: plain text, or richer content (e.g. a method and a path). */
  label: ReactNode;
  /** Full text of a label that may truncate, shown on hover. Defaults to `label` when it's a string. */
  title?: string;
  /** The measure the strip divides (requests, cost, time spent). Rows rank by it, largest first. */
  share: number;
  /** The main, right-most column, usually `share` formatted. */
  value: ReactNode;
  /** Extra columns before Share, in `columns` order. */
  cells?: ReactNode[];
  /** Values the list sorts by, keyed by a column's `sortKey`. A row without one sorts last. */
  sortValues?: Record<string, number | undefined>;
  /** The row's own colour (e.g. one a project keeps across cards), instead of one from the palette. */
  color?: string;
  /** Drill-down for the whole row. */
  href?: string;
  /** Row action (e.g. filter the page to this row); the row renders as a button. */
  onClick?: () => void;
};

export type MetricsShareListColumn = {
  label: string;
  /** Tailwind width class, shared by the header and the cells. Default `w-16`. */
  width?: string;
  /** Makes the header a sort button (with `onSortChange`); rows sort by `sortValues[sortKey]`. */
  sortKey?: string;
  /**
   * `left` for a text column (e.g. a project beside the label): left-aligned columns come straight
   * after the label, in order, before the number columns. Default `right`, for numbers.
   */
  align?: 'left' | 'right';
  /** Explains the column in a tooltip beside its header. */
  description?: ReactNode;
};

export type MetricsShareListSort = { key: string; direction: 'ascending' | 'descending' };

export type MetricsShareListHeaderProps = {
  /** Extra columns before Share, in the rows' `cells` order. */
  columns?: MetricsShareListColumn[];
  /** Header of the main column. */
  valueLabel: string;
  /** Tailwind width class of the main column. Default `w-14`. */
  valueWidth?: string;
  /** Makes the main column's header a sort button, like a column's `sortKey`. */
  valueSortKey?: string;
  /** Explains the main column in a tooltip beside its header. */
  valueDescription?: ReactNode;
  /** The Share column (each row's percentage of the strip). Default on. */
  showShare?: boolean;
  /**
   * The order rows are listed in. The strip, the Share column and each row's colour still follow
   * share, so they keep their meaning whatever the sort.
   */
  sort?: MetricsShareListSort;
  /** Called from a sortable header: the same column again flips the direction, another starts descending. */
  onSortChange?: (sort: MetricsShareListSort) => void;
  className?: string;
};

export type MetricsShareListProps = MetricsShareListHeaderProps & {
  rows: MetricsShareListRow[];
  /**
   * Row colors, from `color` (the first row) on.
   * - `shades`: one hue fading down the ranking. Reads well up to about six rows.
   * - `hues`: five cool hues, lighter each round. For long lists.
   */
  palette?: 'shades' | 'hues';
  /** Color of the first row. Default: brand green. */
  color?: string;
  /** Rows shown before the rest folds or pages. Default 5. */
  limit?: number;
  /**
   * What happens to rows past `limit`.
   * - `other`: one gray "Other (N)" row sums them (a summary card).
   * - `more`: a "Show more" row pages them in (a list to scan, e.g. every route).
   */
  overflow?: 'other' | 'more';
  /** Rows each "Show more" adds. Default 50. */
  pageSize?: number;
  /** Main value and extra cells of the "Other" row, from the rows folded into it. */
  other?: (rest: MetricsShareListRow[]) => Pick<MetricsShareListRow, 'value' | 'cells'>;
  /** Key of the row the page is filtered to: highlighted, and kept listed when it ranks past the shown rows. */
  activeKey?: string;
  /** Header row above the strip. Off when the card shows `MetricsShareList.Header` elsewhere (e.g. beside tabs). */
  showHeader?: boolean;
  /**
   * Where the column headers sit. `top`: above the strip. `below-strip`: between the strip and the
   * rows, right above the values they label, with the rows packed tighter under the strip.
   */
  headerPlacement?: 'top' | 'below-strip';
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Skeleton rows in the list's own markup, so the card keeps its height when data lands. */
  isLoading?: boolean;
  /** Router-aware link for `href` rows; plain `<a>` when omitted. */
  LinkComponent?: ElementType;
  className?: string;
};
