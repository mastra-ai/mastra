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
  /** Drill-down for the whole row. */
  href?: string;
  /** Row action (e.g. filter the page to this row); the row renders as a button. */
  onClick?: () => void;
};

export type MetricsShareListColumn = {
  label: string;
  /** Tailwind width class, shared by the header and the cells. Default `w-16`. */
  width?: string;
};

export type MetricsShareListHeaderProps = {
  /** Extra columns before Share, in the rows' `cells` order. */
  columns?: MetricsShareListColumn[];
  /** Header of the main column. */
  valueLabel: string;
  /** Tailwind width class of the main column. Default `w-14`. */
  valueWidth?: string;
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
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Skeleton rows in the list's own markup, so the card keeps its height when data lands. */
  isLoading?: boolean;
  /** Router-aware link for `href` rows; plain `<a>` when omitted. */
  LinkComponent?: ElementType;
  className?: string;
};
